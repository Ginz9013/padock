import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { remark } from "remark";
import { toString as mdastToString } from "mdast-util-to-string";
import { scopedProcedure, router } from "../trpc.ts";
import { runOrQueue } from "../approvalGate.ts";
import { assertProjectMember } from "../projectAccess.ts";

// Storage is block-based (mdast tree, per the Doc model) but the
// CLI/Skill contract from Phase 1 doesn't change: callers only ever
// see Markdown in `content`, never `blocks`/`searchText` directly.
function toDocResponse<T extends { blocks: unknown; searchText: string }>(doc: T) {
  const { blocks, searchText: _searchText, ...rest } = doc;
  return { ...rest, content: remark.stringify(blocks as Parameters<typeof remark.stringify>[0]) };
}

function parseMarkdown(markdown: string) {
  const tree = remark.parse(markdown);
  return { blocks: tree as object, searchText: mdastToString(tree) };
}

export const docRouter = router({
  create: scopedProcedure("doc", "write")
    .input(
      z.object({
        projectId: z.string(),
        title: z.string().min(1),
        content: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) =>
      runOrQueue(ctx, "doc.create", input, async () => {
        await assertProjectMember(ctx.db, input.projectId, ctx.user.id);
        const { blocks, searchText } = parseMarkdown(input.content);
        const doc = await ctx.db.doc.create({
          data: {
            projectId: input.projectId,
            title: input.title,
            blocks,
            searchText,
            createdById: ctx.user.id,
          },
        });
        return toDocResponse(doc);
      }),
    ),

  list: scopedProcedure("doc", "read")
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertProjectMember(ctx.db, input.projectId, ctx.user.id);
      const docs = await ctx.db.doc.findMany({
        where: { projectId: input.projectId },
        orderBy: { createdAt: "desc" },
      });
      return docs.map(toDocResponse);
    }),

  get: scopedProcedure("doc", "read")
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const doc = await ctx.db.doc.findUniqueOrThrow({ where: { id: input.id } });
      await assertProjectMember(ctx.db, doc.projectId, ctx.user.id);
      return toDocResponse(doc);
    }),

  update: scopedProcedure("doc", "write")
    .input(
      z.object({
        id: z.string(),
        title: z.string().min(1).optional(),
        content: z.string().optional(),
        // Optimistic lock (CONTEXT.md §5.1.16) — the web UI's autosave
        // always sends the `updatedAt` it last saw, so a concurrent
        // write (another tab, or an agent via CLI/MCP) can't silently
        // clobber it; a mismatch throws CONFLICT instead of saving.
        // CLI/MCP callers omit this and keep today's fire-and-forget
        // write behavior — deliberate, not an oversight.
        expectedUpdatedAt: z.coerce.date().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) =>
      runOrQueue(ctx, "doc.update", input, async () => {
        const { id, content, expectedUpdatedAt, ...rest } = input;
        const existing = await ctx.db.doc.findUniqueOrThrow({ where: { id } });
        await assertProjectMember(ctx.db, existing.projectId, ctx.user.id);
        if (expectedUpdatedAt && existing.updatedAt.getTime() !== expectedUpdatedAt.getTime()) {
          throw new TRPCError({ code: "CONFLICT", message: "Doc was updated elsewhere" });
        }
        const parsed = content !== undefined ? parseMarkdown(content) : {};
        const doc = await ctx.db.doc.update({ where: { id }, data: { ...rest, ...parsed } });
        return toDocResponse(doc);
      }),
    ),
});
