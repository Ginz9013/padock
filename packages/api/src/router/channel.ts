import { z } from "zod";
import { scopedProcedure, router } from "../trpc.ts";
import { runOrQueue } from "../approvalGate.ts";

export const channelRouter = router({
  create: scopedProcedure("channel", "write")
    .input(z.object({ name: z.string().min(1), projectId: z.string().optional() }))
    .mutation(async ({ ctx, input }) =>
      runOrQueue(ctx, "channel.create", input, () =>
        ctx.db.channel.create({
          data: {
            name: input.name,
            projectId: input.projectId,
            createdById: ctx.user.id,
          },
        }),
      ),
    ),

  list: scopedProcedure("channel", "read")
    .input(z.object({ projectId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      return ctx.db.channel.findMany({
        where: input?.projectId ? { projectId: input.projectId } : undefined,
        orderBy: { createdAt: "desc" },
      });
    }),
});
