import { z } from "zod";
import { scopedProcedure, router } from "../trpc.ts";
import { runOrQueue } from "../approvalGate.ts";
import { assertProjectMember } from "../projectAccess.ts";

export const labelRouter = router({
  create: scopedProcedure("label", "write")
    .input(
      z.object({
        projectId: z.string(),
        name: z.string().min(1),
        color: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) =>
      runOrQueue(ctx, "label.create", input, async () => {
        await assertProjectMember(ctx.db, input.projectId, ctx.user.id);
        return ctx.db.label.create({
          data: { projectId: input.projectId, name: input.name, color: input.color },
        });
      }),
    ),

  list: scopedProcedure("label", "read")
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertProjectMember(ctx.db, input.projectId, ctx.user.id);
      return ctx.db.label.findMany({
        where: { projectId: input.projectId },
        orderBy: { createdAt: "asc" },
      });
    }),

  delete: scopedProcedure("label", "write")
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) =>
      runOrQueue(ctx, "label.delete", input, async () => {
        const label = await ctx.db.label.findUniqueOrThrow({ where: { id: input.id } });
        await assertProjectMember(ctx.db, label.projectId, ctx.user.id);
        await ctx.db.label.delete({ where: { id: input.id } });
        return { id: input.id };
      }),
    ),
});
