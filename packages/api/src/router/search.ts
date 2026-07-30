import { z } from "zod";
import { Prisma } from "@padock/db";
import { scopedProcedure, router } from "../trpc.ts";

const scopeEnum = z.enum(["docs", "tasks", "chat"]);

interface SearchResult {
  type: "doc" | "task" | "chat";
  id: string;
  projectId: string | null;
  channelId: string | null;
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
  search: scopedProcedure("search", "read")
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
        // searchText is a plain-text extraction of the block tree
        // (packages/db's Doc model) — content itself is now stored as
        // blocks (JSON), not a plain-text column tsvector can index.
        const rows = await ctx.db.$queryRaw<
          Array<{ id: string; projectId: string; title: string; searchText: string; createdAt: Date; rank: number }>
        >`
          SELECT id, "projectId", title, "searchText", "createdAt",
                 ts_rank(to_tsvector('english', title || ' ' || "searchText"), websearch_to_tsquery('english', ${input.query})) AS rank
          FROM doc
          WHERE to_tsvector('english', title || ' ' || "searchText") @@ websearch_to_tsquery('english', ${input.query})
          ${projectFilter}
          ORDER BY rank DESC
          LIMIT 20
        `;
        for (const row of rows) {
          results.push({
            type: "doc",
            id: row.id,
            projectId: row.projectId,
            channelId: null,
            title: row.title,
            snippet: row.searchText.slice(0, 200),
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
            channelId: null,
            title: row.title,
            snippet: (row.description ?? "").slice(0, 200),
            rank: Number(row.rank),
            createdAt: row.createdAt,
          });
        }
      }

      if (scopes.includes("chat")) {
        // Channel messages have no visibility restriction (no
        // per-channel membership model, §6/§7) — DMs stay restricted
        // to sender/recipient. A channel message's "project" comes
        // from its channel, not its own projectId (§5.1.2), so the
        // project filter has to check both.
        const chatProjectFilter = input.projectId
          ? Prisma.sql`AND (cm."projectId" = ${input.projectId} OR ch."projectId" = ${input.projectId})`
          : Prisma.empty;
        const rows = await ctx.db.$queryRaw<
          Array<{
            id: string;
            projectId: string | null;
            channelId: string | null;
            content: string;
            createdAt: Date;
            rank: number;
          }>
        >`
          SELECT cm.id, cm."projectId", cm."channelId", cm.content, cm."createdAt",
                 ts_rank(to_tsvector('english', cm.content), websearch_to_tsquery('english', ${input.query})) AS rank
          FROM chat_message cm
          LEFT JOIN channel ch ON ch.id = cm."channelId"
          WHERE to_tsvector('english', cm.content) @@ websearch_to_tsquery('english', ${input.query})
            AND (cm."senderId" = ${ctx.user.id} OR cm."recipientId" = ${ctx.user.id} OR cm."channelId" IS NOT NULL)
          ${chatProjectFilter}
          ORDER BY rank DESC
          LIMIT 20
        `;
        for (const row of rows) {
          results.push({
            type: "chat",
            id: row.id,
            projectId: row.projectId,
            channelId: row.channelId,
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
