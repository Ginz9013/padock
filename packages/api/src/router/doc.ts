import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Prisma, type PrismaClient } from "@padock/db";
import { remark } from "remark";
import { toString as mdastToString } from "mdast-util-to-string";
import { scopedProcedure, router } from "../trpc.ts";
import { runOrQueue } from "../approvalGate.ts";
import { assertProjectMember } from "../projectAccess.ts";

// findUniqueOrThrow's Prisma-level "record not found" (P2025) surfaces
// as a distinct NOT_FOUND here rather than a generic 500 — matters most
// for update (CONTEXT.md §5.1.17): a doc deleted out from under an open
// editor needs a different recovery UX ("this doc was deleted, your
// changes weren't saved") than a version CONFLICT ("reload vs.
// overwrite") gives, since there's nothing left to reload.
async function findDocOrNotFound(db: PrismaClient, id: string) {
  try {
    return await db.doc.findUniqueOrThrow({ where: { id } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      throw new TRPCError({ code: "NOT_FOUND", message: "Doc not found" });
    }
    throw err;
  }
}

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
      // attributeValues only needed on the Doc detail page (CONTEXT.md
      // §5.1.18's property panel), so `list` deliberately doesn't include
      // it — the Docs list stays a lightweight query.
      const doc = await ctx.db.doc.findUnique({
        where: { id: input.id },
        include: { attributeValues: true },
      });
      if (!doc) throw new TRPCError({ code: "NOT_FOUND", message: "Doc not found" });
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
        const existing = await findDocOrNotFound(ctx.db, id);
        await assertProjectMember(ctx.db, existing.projectId, ctx.user.id);
        if (expectedUpdatedAt && existing.updatedAt.getTime() !== expectedUpdatedAt.getTime()) {
          throw new TRPCError({ code: "CONFLICT", message: "Doc was updated elsewhere" });
        }
        const parsed = content !== undefined ? parseMarkdown(content) : {};
        const doc = await ctx.db.doc.update({ where: { id }, data: { ...rest, ...parsed } });
        return toDocResponse(doc);
      }),
    ),

  // Optional expectedUpdatedAt (CONTEXT.md §5.1.17) protects against
  // deleting a doc that was edited more recently than whoever clicked
  // delete last saw it — same optimistic-lock shape as update. Doesn't
  // catch every race (a delete that lands before the open editor's own
  // first autosave isn't caught by any lock), which is what
  // findDocOrNotFound's NOT_FOUND handling in update is for.
  delete: scopedProcedure("doc", "write")
    .input(z.object({ id: z.string(), expectedUpdatedAt: z.coerce.date().optional() }))
    .mutation(async ({ ctx, input }) =>
      runOrQueue(ctx, "doc.delete", input, async () => {
        const existing = await findDocOrNotFound(ctx.db, input.id);
        await assertProjectMember(ctx.db, existing.projectId, ctx.user.id);
        if (input.expectedUpdatedAt && existing.updatedAt.getTime() !== input.expectedUpdatedAt.getTime()) {
          throw new TRPCError({ code: "CONFLICT", message: "Doc was updated elsewhere" });
        }
        await ctx.db.doc.delete({ where: { id: input.id } });
        return { id: input.id };
      }),
    ),

  // Sets/clears one attribute value on a doc (CONTEXT.md §5.1.18) — lives
  // here rather than on docAttribute.ts, same precedent as
  // task.updateLabels attaching a Label to a Task from task.ts, not
  // label.ts. Saves immediately per-field (no debounce, unlike title/
  // content) since attribute edits are discrete actions (pick a date,
  // toggle a box), not continuous typing. `value: null` deletes the row
  // instead of writing all-null columns — "no value set" stays "no row",
  // consistent with new definitions never backfilling existing docs.
  setAttributeValue: scopedProcedure("doc", "write")
    .input(
      z.object({
        docId: z.string(),
        definitionId: z.string(),
        value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
      }),
    )
    .mutation(async ({ ctx, input }) =>
      runOrQueue(ctx, "doc.setAttributeValue", input, async () => {
        const doc = await findDocOrNotFound(ctx.db, input.docId);
        await assertProjectMember(ctx.db, doc.projectId, ctx.user.id);
        const definition = await ctx.db.docAttributeDefinition.findUniqueOrThrow({
          where: { id: input.definitionId },
        });
        if (definition.projectId !== doc.projectId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Attribute doesn't belong to this doc's project" });
        }

        if (input.value === null) {
          await ctx.db.docAttributeValue.deleteMany({
            where: { docId: input.docId, definitionId: input.definitionId },
          });
          return { docId: input.docId, definitionId: input.definitionId, value: null };
        }

        const data = await toValueColumns(ctx.db, definition, input.value);
        await ctx.db.docAttributeValue.upsert({
          where: { docId_definitionId: { docId: input.docId, definitionId: input.definitionId } },
          create: { docId: input.docId, definitionId: input.definitionId, ...data },
          update: data,
        });
        return { docId: input.docId, definitionId: input.definitionId, value: input.value };
      }),
    ),
});

// Validates `value` against the definition's fixed type (CONTEXT.md
// §5.1.18: type is immutable, so this check is the only place that needs
// to know the text/number/select/date/checkbox mapping) and returns the
// one typed column to write, clearing the other four.
async function toValueColumns(
  db: PrismaClient,
  definition: { id: string; type: string },
  value: string | number | boolean,
) {
  const empty = {
    valueText: null,
    valueNumber: null,
    valueDate: null,
    valueBoolean: null,
    selectOptionId: null,
  };
  switch (definition.type) {
    case "text":
      if (typeof value !== "string") throw new TRPCError({ code: "BAD_REQUEST", message: "Expected a string" });
      return { ...empty, valueText: value };
    case "number":
      if (typeof value !== "number") throw new TRPCError({ code: "BAD_REQUEST", message: "Expected a number" });
      return { ...empty, valueNumber: value };
    case "checkbox":
      if (typeof value !== "boolean") throw new TRPCError({ code: "BAD_REQUEST", message: "Expected a boolean" });
      return { ...empty, valueBoolean: value };
    case "date": {
      if (typeof value !== "string") throw new TRPCError({ code: "BAD_REQUEST", message: "Expected a date string" });
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid date" });
      return { ...empty, valueDate: date };
    }
    case "select": {
      if (typeof value !== "string") throw new TRPCError({ code: "BAD_REQUEST", message: "Expected an option id" });
      const option = await db.docAttributeOption.findUniqueOrThrow({ where: { id: value } });
      if (option.definitionId !== definition.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Option doesn't belong to this attribute" });
      }
      return { ...empty, selectOptionId: value };
    }
    default:
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Unknown attribute type: ${definition.type}` });
  }
}
