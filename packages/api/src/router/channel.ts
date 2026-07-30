import { z } from "zod";
import { scopedProcedure, router } from "../trpc.ts";
import { runOrQueue } from "../approvalGate.ts";

// Single-level message container per ADR-0001 (docs/adr/0001-collapse-
// topic-into-channel.md) — absorbs the old, separate Topic entity.
// Org-wide or project-scoped (projectId optional). Must be created
// explicitly before use; never materializes implicitly from a message
// send (unchanged from the old Topic's behavior).
export const channelRouter = router({
  create: scopedProcedure("channel", "write")
    .input(z.object({ title: z.string().min(1), projectId: z.string().optional() }))
    .mutation(async ({ ctx, input }) =>
      runOrQueue(ctx, "channel.create", input, () =>
        ctx.db.channel.create({
          data: {
            title: input.title,
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
