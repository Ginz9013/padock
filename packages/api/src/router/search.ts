import { z } from "zod";
import { Prisma } from "@padock/db";
import { protectedProcedure, router } from "../trpc.ts";

const scopeEnum = z.enum(["docs", "tasks", "chat"]);

interface SearchResult {
  type: "doc" | "task" | "chat";
  id: string;
  projectId: string | null;
  title: string | null;
  snippet: string;
  rank: number;
  createdAt: Date;
}

// Postgres full-text search (tsvector), not semantic/vector search —
// CONTEXT.md §5.1.3/§6: keeps the "no API token required" premise
// honest (no embedding-model dependency). No persisted tsvector column
// or GIN index yet — fine at dogfooding scale, a pure perf upgrade
// later that doesn't change this procedure's shape.
export const searchRouter = router({
  search: protectedProcedure
    .input(
      z.object({
        query: z.string().min(1),
        scope: z.array(scopeEnum).optional(),
        projectId: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const scopes = input.scope ?? (["docs", "tasks", "chat"] as const);
      const projectFilter = input.projectId
        ? Prisma.sql`AND "projectId" = ${input.projectId}`
        : Prisma.empty;
      const results: SearchResult[] = [];

      if (scopes.includes("docs")) {
        const rows = await ctx.db.$queryRaw<
          Array<{ id: string; projectId: string; title: string; content: string; createdAt: Date; rank: number }>
        >`
          SELECT id, "projectId", title, content, "createdAt",
                 ts_rank(to_tsvector('english', title || ' ' || content), websearch_to_tsquery('english', ${input.query})) AS rank
          FROM doc
          WHERE to_tsvector('english', title || ' ' || content) @@ websearch_to_tsquery('english', ${input.query})
          ${projectFilter}
          ORDER BY rank DESC
          LIMIT 20
        `;
        for (const row of rows) {
          results.push({
            type: "doc",
            id: row.id,
            projectId: row.projectId,
            title: row.title,
            snippet: row.content.slice(0, 200),
            rank: Number(row.rank),
            createdAt: row.createdAt,
          });
        }
      }

      if (scopes.includes("tasks")) {
        const rows = await ctx.db.$queryRaw<
          Array<{
            id: string;
            projectId: string;
            title: string;
            description: string | null;
            createdAt: Date;
            rank: number;
          }>
        >`
          SELECT id, "projectId", title, description, "createdAt",
                 ts_rank(to_tsvector('english', title || ' ' || coalesce(description, '')), websearch_to_tsquery('english', ${input.query})) AS rank
          FROM task
          WHERE to_tsvector('english', title || ' ' || coalesce(description, '')) @@ websearch_to_tsquery('english', ${input.query})
          ${projectFilter}
          ORDER BY rank DESC
          LIMIT 20
        `;
        for (const row of rows) {
          results.push({
            type: "task",
            id: row.id,
            projectId: row.projectId,
            title: row.title,
            snippet: (row.description ?? "").slice(0, 200),
            rank: Number(row.rank),
            createdAt: row.createdAt,
          });
        }
      }

      if (scopes.includes("chat")) {
        const rows = await ctx.db.$queryRaw<
          Array<{ id: string; projectId: string | null; content: string; createdAt: Date; rank: number }>
        >`
          SELECT id, "projectId", content, "createdAt",
                 ts_rank(to_tsvector('english', content), websearch_to_tsquery('english', ${input.query})) AS rank
          FROM chat_message
          WHERE to_tsvector('english', content) @@ websearch_to_tsquery('english', ${input.query})
            AND ("senderId" = ${ctx.user.id} OR "recipientId" = ${ctx.user.id})
          ${projectFilter}
          ORDER BY rank DESC
          LIMIT 20
        `;
        for (const row of rows) {
          results.push({
            type: "chat",
            id: row.id,
            projectId: row.projectId,
            title: null,
            snippet: row.content.slice(0, 200),
            rank: Number(row.rank),
            createdAt: row.createdAt,
          });
        }
      }

      results.sort((a, b) => b.rank - a.rank);
      return results;
    }),
});
