import { z } from "zod";
import { scopedProcedure, router } from "../trpc.ts";
import { runOrQueue } from "../approvalGate.ts";
import { assertProjectMember } from "../projectAccess.ts";

// Single-level message container per ADR-0001 (docs/adr/0001-collapse-
// topic-into-channel.md) — absorbs the old, separate Topic entity.
// Org-wide (projectId null) channels stay open to every org member, per
// CONTEXT.md §5.1.10 — that decision is reversed for project-scoped
// channels only: those now require the caller to be a ProjectMember,
// same as task/doc. Must be created explicitly before use; never
// materializes implicitly from a message send (unchanged from Topic).
export const channelRouter = router({
  create: scopedProcedure("channel", "write")
    .input(z.object({ title: z.string().min(1), projectId: z.string().optional() }))
    .mutation(async ({ ctx, input }) =>
      runOrQueue(ctx, "channel.create", input, async () => {
        if (input.projectId) {
          await assertProjectMember(ctx.db, input.projectId, ctx.user.id);
        }
        return ctx.db.channel.create({
          data: {
            title: input.title,
            projectId: input.projectId,
            createdById: ctx.user.id,
          },
        });
      }),
    ),

  // No `projectId` filter returns only org-wide channels, not every
  // project-scoped channel in the org — matches what the web sidebar
  // already filtered down to client-side; a specific project's channels
  // require being a member of it (see the module comment above).
  list: scopedProcedure("channel", "read")
    .input(z.object({ projectId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      if (input?.projectId) {
        await assertProjectMember(ctx.db, input.projectId, ctx.user.id);
      }
      return ctx.db.channel.findMany({
        where: input?.projectId ? { projectId: input.projectId } : { projectId: null },
        orderBy: { createdAt: "desc" },
      });
    }),
});
