import { z } from "zod";
import { scopedProcedure, router } from "../trpc.ts";

const groupEnum = z.enum(["backlog", "unstarted", "started", "completed", "cancelled"]);

export const taskStateRouter = router({
  create: scopedProcedure("taskState", "write")
    .input(
      z.object({
        projectId: z.string(),
        name: z.string().min(1),
        group: groupEnum,
        isDefault: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const count = await ctx.db.taskState.count({ where: { projectId: input.projectId } });
      return ctx.db.taskState.create({
        data: {
          projectId: input.projectId,
          name: input.name,
          group: input.group,
          position: count,
          isDefault: input.isDefault ?? false,
        },
      });
    }),

  list: scopedProcedure("taskState", "read")
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.taskState.findMany({
        where: { projectId: input.projectId },
        orderBy: { position: "asc" },
      });
    }),
});
