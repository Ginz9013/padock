import { z } from "zod";
import { protectedProcedure, router } from "../trpc.ts";

export const channelRouter = router({
  create: protectedProcedure
    .input(z.object({ name: z.string().min(1), projectId: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.channel.create({
        data: {
          name: input.name,
          projectId: input.projectId,
          createdById: ctx.user.id,
        },
      });
    }),

  list: protectedProcedure
    .input(z.object({ projectId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      return ctx.db.channel.findMany({
        where: input?.projectId ? { projectId: input.projectId } : undefined,
        orderBy: { createdAt: "desc" },
      });
    }),
});
