import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { scopedProcedure, router } from "../trpc.ts";
import { assertProjectMember } from "../projectAccess.ts";

// Reads back the write-side trail written by scopedProcedure's audit-log
// branch (packages/api/src/trpc.ts) — no dedicated entityId/entityType
// column exists there (AuditLog stores raw path+input, deliberately not a
// structured per-domain reference), so "logs for this doc" is a JSONB
// filter on the two shapes doc.ts's write endpoints actually send: `id`
// (update/delete) or `docId` (setAttributeValue). doc.create is not and
// cannot be matched this way — the created doc's id is server-generated,
// not present in that call's own input — so a doc's creation event never
// appears here. Accepted as a known v1 gap rather than widening
// writeAuditLog to also capture each call's result.
export const auditLogRouter = router({
  forDoc: scopedProcedure("doc", "read")
    .input(z.object({ docId: z.string() }))
    .query(async ({ ctx, input }) => {
      const doc = await ctx.db.doc.findUnique({
        where: { id: input.docId },
        select: { projectId: true },
      });
      if (!doc) throw new TRPCError({ code: "NOT_FOUND", message: "Doc not found" });
      await assertProjectMember(ctx.db, doc.projectId, ctx.user.id);

      const logs = await ctx.db.auditLog.findMany({
        where: {
          OR: [
            { path: { in: ["doc.update", "doc.delete"] }, input: { path: ["id"], equals: input.docId } },
            { path: "doc.setAttributeValue", input: { path: ["docId"], equals: input.docId } },
          ],
        },
        orderBy: { createdAt: "desc" },
        include: { actor: { select: { name: true } } },
      });

      return logs.map((log) => ({
        id: log.id,
        path: log.path,
        createdAt: log.createdAt,
        actorName: log.actor.name,
      }));
    }),

  // Same JSONB-filter approach as forDoc above, but simpler: every write
  // endpoint on task.ts (update/updateState/updatePriority/updateDates/
  // updateAssignees/updateLabels) takes the target as `id`, so one path
  // list suffices instead of doc's id-vs-docId split. task.create has the
  // same gap as doc.create — no id in its own input to match back against.
  forTask: scopedProcedure("task", "read")
    .input(z.object({ taskId: z.string() }))
    .query(async ({ ctx, input }) => {
      const task = await ctx.db.task.findUnique({
        where: { id: input.taskId },
        select: { projectId: true },
      });
      if (!task) throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      await assertProjectMember(ctx.db, task.projectId, ctx.user.id);

      const logs = await ctx.db.auditLog.findMany({
        where: {
          path: {
            in: [
              "task.update",
              "task.updateState",
              "task.updatePriority",
              "task.updateDates",
              "task.updateAssignees",
              "task.updateLabels",
            ],
          },
          input: { path: ["id"], equals: input.taskId },
        },
        orderBy: { createdAt: "desc" },
        include: { actor: { select: { name: true } } },
      });

      return logs.map((log) => ({
        id: log.id,
        path: log.path,
        createdAt: log.createdAt,
        actorName: log.actor.name,
      }));
    }),
});
