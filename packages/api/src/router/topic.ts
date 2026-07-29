import { z } from "zod";
import { scopedProcedure, router } from "../trpc.ts";

export const topicRouter = router({
  create: scopedProcedure("topic", "write")
    .input(z.object({ channelId: z.string(), title: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.topic.create({
        data: {
          channelId: input.channelId,
          title: input.title,
          createdById: ctx.user.id,
        },
      });
    }),

  list: scopedProcedure("topic", "read")
    .input(z.object({ channelId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.topic.findMany({
        where: { channelId: input.channelId },
        orderBy: { createdAt: "desc" },
      });
    }),
});
