import { z } from "zod";
import { protectedProcedure, router } from "../trpc.ts";

const taskStatus = z.enum(["todo", "in_progress", "review", "done"]);

export const taskRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        title: z.string().min(1),
        description: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.task.create({
        data: {
          projectId: input.projectId,
          title: input.title,
          description: input.description,
          createdById: ctx.user.id,
        },
      });
    }),

  list: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.task.findMany({
        where: { projectId: input.projectId },
        orderBy: { createdAt: "desc" },
      });
    }),

  updateStatus: protectedProcedure
    .input(z.object({ id: z.string(), status: taskStatus }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.task.update({
        where: { id: input.id },
        data: { status: input.status },
      });
    }),
});
