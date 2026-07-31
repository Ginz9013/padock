import { z } from "zod";
import { scopedProcedure, router } from "../trpc.ts";
import { runOrQueue } from "../approvalGate.ts";
import { assertProjectMember } from "../projectAccess.ts";

const typeEnum = z.enum(["text", "number", "select", "date", "checkbox"]);

const definitionInclude = { options: { orderBy: { order: "asc" as const } } };

// Doc attribute schema (CONTEXT.md §5.1.18): project-scoped, user-defined
// property definitions — no attributes ship pre-defined, every project
// starts empty. Separate router/scope from `doc`, same precedent as
// `label` being its own resource even though it's conceptually a Task
// sub-feature; value-setting itself lives on `doc.setAttributeValue`
// instead, mirroring how `task.updateLabels` (not `label.ts`) is what
// actually attaches a Label to a Task.
export const docAttributeRouter = router({
  list: scopedProcedure("docAttribute", "read")
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertProjectMember(ctx.db, input.projectId, ctx.user.id);
      return ctx.db.docAttributeDefinition.findMany({
        where: { projectId: input.projectId },
        orderBy: { order: "asc" },
        include: definitionInclude,
      });
    }),

  create: scopedProcedure("docAttribute", "write")
    .input(z.object({ projectId: z.string(), name: z.string().min(1), type: typeEnum }))
    .mutation(async ({ ctx, input }) =>
      runOrQueue(ctx, "docAttribute.create", input, async () => {
        await assertProjectMember(ctx.db, input.projectId, ctx.user.id);
        const count = await ctx.db.docAttributeDefinition.count({ where: { projectId: input.projectId } });
        return ctx.db.docAttributeDefinition.create({
          data: { projectId: input.projectId, name: input.name, type: input.type, order: count },
          include: definitionInclude,
        });
      }),
    ),

  rename: scopedProcedure("docAttribute", "write")
    .input(z.object({ id: z.string(), name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) =>
      runOrQueue(ctx, "docAttribute.rename", input, async () => {
        const definition = await ctx.db.docAttributeDefinition.findUniqueOrThrow({ where: { id: input.id } });
        await assertProjectMember(ctx.db, definition.projectId, ctx.user.id);
        return ctx.db.docAttributeDefinition.update({
          where: { id: input.id },
          data: { name: input.name },
          include: definitionInclude,
        });
      }),
    ),

  // Full replace, same "small list, whole-order resend" semantics as
  // TaskState/Board reordering elsewhere in this codebase.
  reorder: scopedProcedure("docAttribute", "write")
    .input(z.object({ projectId: z.string(), orderedIds: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) =>
      runOrQueue(ctx, "docAttribute.reorder", input, async () => {
        await assertProjectMember(ctx.db, input.projectId, ctx.user.id);
        await ctx.db.$transaction(
          input.orderedIds.map((id, order) =>
            ctx.db.docAttributeDefinition.update({
              where: { id, projectId: input.projectId },
              data: { order },
            }),
          ),
        );
        return ctx.db.docAttributeDefinition.findMany({
          where: { projectId: input.projectId },
          orderBy: { order: "asc" },
          include: definitionInclude,
        });
      }),
    ),

  // Cascades to every DocAttributeValue referencing it (DB-level, §5.1.18)
  // — no soft-delete/undo, same precedent as Label delete.
  delete: scopedProcedure("docAttribute", "write")
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) =>
      runOrQueue(ctx, "docAttribute.delete", input, async () => {
        const definition = await ctx.db.docAttributeDefinition.findUniqueOrThrow({ where: { id: input.id } });
        await assertProjectMember(ctx.db, definition.projectId, ctx.user.id);
        await ctx.db.docAttributeDefinition.delete({ where: { id: input.id } });
        return { id: input.id };
      }),
    ),

  createOption: scopedProcedure("docAttribute", "write")
    .input(z.object({ definitionId: z.string(), name: z.string().min(1), color: z.string().min(1) }))
    .mutation(async ({ ctx, input }) =>
      runOrQueue(ctx, "docAttribute.createOption", input, async () => {
        const definition = await ctx.db.docAttributeDefinition.findUniqueOrThrow({
          where: { id: input.definitionId },
        });
        await assertProjectMember(ctx.db, definition.projectId, ctx.user.id);
        const count = await ctx.db.docAttributeOption.count({ where: { definitionId: input.definitionId } });
        await ctx.db.docAttributeOption.create({
          data: { definitionId: input.definitionId, name: input.name, color: input.color, order: count },
        });
        return ctx.db.docAttributeDefinition.findUniqueOrThrow({
          where: { id: input.definitionId },
          include: definitionInclude,
        });
      }),
    ),

  renameOption: scopedProcedure("docAttribute", "write")
    .input(z.object({ id: z.string(), name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) =>
      runOrQueue(ctx, "docAttribute.renameOption", input, async () => {
        const option = await ctx.db.docAttributeOption.findUniqueOrThrow({
          where: { id: input.id },
          include: { definition: true },
        });
        await assertProjectMember(ctx.db, option.definition.projectId, ctx.user.id);
        await ctx.db.docAttributeOption.update({ where: { id: input.id }, data: { name: input.name } });
        return ctx.db.docAttributeDefinition.findUniqueOrThrow({
          where: { id: option.definitionId },
          include: definitionInclude,
        });
      }),
    ),

  // Cascades to every DocAttributeValue pointing at this one option only
  // (its `selectOptionId` FK), leaving the definition and its other
  // options untouched — narrower than deleting the whole definition.
  deleteOption: scopedProcedure("docAttribute", "write")
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) =>
      runOrQueue(ctx, "docAttribute.deleteOption", input, async () => {
        const option = await ctx.db.docAttributeOption.findUniqueOrThrow({
          where: { id: input.id },
          include: { definition: true },
        });
        await assertProjectMember(ctx.db, option.definition.projectId, ctx.user.id);
        await ctx.db.docAttributeOption.delete({ where: { id: input.id } });
        return ctx.db.docAttributeDefinition.findUniqueOrThrow({
          where: { id: option.definitionId },
          include: definitionInclude,
        });
      }),
    ),
});
