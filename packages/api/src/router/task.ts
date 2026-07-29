import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../trpc.ts";

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
      const defaultState = await ctx.db.taskState.findFirst({
        where: { projectId: input.projectId, isDefault: true },
      });
      if (!defaultState) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Project has no default task state — create one with task-state create first",
        });
      }
      return ctx.db.task.create({
        data: {
          projectId: input.projectId,
          title: input.title,
          description: input.description,
          stateId: defaultState.id,
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

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.task.findUniqueOrThrow({ where: { id: input.id } });
    }),

  // Takes a resolved stateId, not a name — name resolution (against
  // the task's own project's states) happens CLI-side, same pattern
  // as project/channel (resolve.ts).
  updateState: protectedProcedure
    .input(z.object({ id: z.string(), stateId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.task.update({
        where: { id: input.id },
        data: { stateId: input.stateId },
      });
    }),
});
