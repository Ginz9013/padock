import { z } from "zod";
import { remark } from "remark";
import { toString as mdastToString } from "mdast-util-to-string";
import { protectedProcedure, router } from "../trpc.ts";

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
  create: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        title: z.string().min(1),
        content: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
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

  list: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const docs = await ctx.db.doc.findMany({
        where: { projectId: input.projectId },
        orderBy: { createdAt: "desc" },
      });
      return docs.map(toDocResponse);
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const doc = await ctx.db.doc.findUniqueOrThrow({ where: { id: input.id } });
      return toDocResponse(doc);
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().min(1).optional(),
        content: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, content, ...rest } = input;
      const parsed = content !== undefined ? parseMarkdown(content) : {};
      const doc = await ctx.db.doc.update({ where: { id }, data: { ...rest, ...parsed } });
      return toDocResponse(doc);
    }),
});
