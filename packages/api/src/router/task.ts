import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { PrismaClient } from "@padock/db";
import { scopedProcedure, router } from "../trpc.ts";
import { runOrQueue } from "../approvalGate.ts";
import { assertProjectMember } from "../projectAccess.ts";

const taskAssigneeInclude = {
  assignees: { include: { projectMember: { include: { user: true } } } },
  labels: { include: { label: true } },
} as const;

const priorityEnum = z.enum(["urgent", "high", "medium", "low", "none"]);

// Assignees are given as User ids (what every caller actually has on
// hand), resolved here against the task's own project's ProjectMembers —
// the "assignee must already be a project member" invariant (schema.prisma's
// TaskAssignee comment) is enforced at this boundary, not the CLI.
async function resolveAssigneeMemberIds(db: PrismaClient, projectId: string, userIds: string[]): Promise<string[]> {
  if (userIds.length === 0) return [];
  const members = await db.projectMember.findMany({
    where: { projectId, userId: { in: userIds } },
  });
  const foundUserIds = new Set(members.map((m) => m.userId));
  const missing = userIds.filter((id) => !foundUserIds.has(id));
  if (missing.length > 0) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: `Not members of this project, can't be assigned: ${missing.join(", ")}`,
    });
  }
  return members.map((m) => m.id);
}

// Same "must belong to this task's own project" invariant as assignees,
// enforced at this boundary (schema.prisma's TaskLabel comment).
async function resolveLabelIds(db: PrismaClient, projectId: string, labelIds: string[]): Promise<string[]> {
  if (labelIds.length === 0) return [];
  const labels = await db.label.findMany({ where: { projectId, id: { in: labelIds } } });
  const foundIds = new Set(labels.map((l) => l.id));
  const missing = labelIds.filter((id) => !foundIds.has(id));
  if (missing.length > 0) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: `Not labels of this project: ${missing.join(", ")}`,
    });
  }
  return labels.map((l) => l.id);
}

export const taskRouter = router({
  create: scopedProcedure("task", "write")
    .input(
      z.object({
        projectId: z.string(),
        title: z.string().min(1),
        description: z.string().optional(),
        priority: priorityEnum.optional(),
        startDate: z.coerce.date().optional(),
        endDate: z.coerce.date().optional(),
        assigneeUserIds: z.array(z.string()).optional(),
        labelIds: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) =>
      runOrQueue(ctx, "task.create", input, async () => {
        await assertProjectMember(ctx.db, input.projectId, ctx.user.id);
        const defaultState = await ctx.db.taskState.findFirst({
          where: { projectId: input.projectId, isDefault: true },
        });
        if (!defaultState) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Project has no default task state — create one with task-state create first",
          });
        }
        const memberIds = await resolveAssigneeMemberIds(ctx.db, input.projectId, input.assigneeUserIds ?? []);
        const labelIds = await resolveLabelIds(ctx.db, input.projectId, input.labelIds ?? []);
        return ctx.db.task.create({
          data: {
            projectId: input.projectId,
            title: input.title,
            description: input.description,
            stateId: defaultState.id,
            priority: input.priority,
            startDate: input.startDate,
            endDate: input.endDate,
            createdById: ctx.user.id,
            assignees: { create: memberIds.map((projectMemberId) => ({ projectMemberId })) },
            labels: { create: labelIds.map((labelId) => ({ labelId })) },
          },
          include: taskAssigneeInclude,
        });
      }),
    ),

  list: scopedProcedure("task", "read")
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertProjectMember(ctx.db, input.projectId, ctx.user.id);
      return ctx.db.task.findMany({
        where: { projectId: input.projectId },
        orderBy: { createdAt: "desc" },
        include: taskAssigneeInclude,
      });
    }),

  get: scopedProcedure("task", "read")
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const task = await ctx.db.task.findUniqueOrThrow({
        where: { id: input.id },
        include: taskAssigneeInclude,
      });
      await assertProjectMember(ctx.db, task.projectId, ctx.user.id);
      return task;
    }),

  update: scopedProcedure("task", "write")
    .input(
      z.object({
        id: z.string(),
        title: z.string().min(1).optional(),
        description: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) =>
      runOrQueue(ctx, "task.update", input, async () => {
        const { id, ...rest } = input;
        const task = await ctx.db.task.findUniqueOrThrow({ where: { id } });
        await assertProjectMember(ctx.db, task.projectId, ctx.user.id);
        return ctx.db.task.update({ where: { id }, data: rest });
      }),
    ),

  // Takes a resolved stateId, not a name — name resolution (against
  // the task's own project's states) happens CLI-side, same pattern
  // as project/channel (resolve.ts).
  updateState: scopedProcedure("task", "write")
    .input(z.object({ id: z.string(), stateId: z.string() }))
    .mutation(async ({ ctx, input }) =>
      runOrQueue(ctx, "task.updateState", input, async () => {
        const task = await ctx.db.task.findUniqueOrThrow({ where: { id: input.id } });
        await assertProjectMember(ctx.db, task.projectId, ctx.user.id);
        return ctx.db.task.update({
          where: { id: input.id },
          data: { stateId: input.stateId },
        });
      }),
    ),

  updatePriority: scopedProcedure("task", "write")
    .input(z.object({ id: z.string(), priority: priorityEnum }))
    .mutation(async ({ ctx, input }) =>
      runOrQueue(ctx, "task.updatePriority", input, async () => {
        const task = await ctx.db.task.findUniqueOrThrow({ where: { id: input.id } });
        await assertProjectMember(ctx.db, task.projectId, ctx.user.id);
        return ctx.db.task.update({
          where: { id: input.id },
          data: { priority: input.priority },
        });
      }),
    ),

  // `null` clears the field, `undefined`/omitted leaves it untouched —
  // lets a caller move just one of the two dates.
  updateDates: scopedProcedure("task", "write")
    .input(
      z.object({
        id: z.string(),
        startDate: z.coerce.date().nullable().optional(),
        endDate: z.coerce.date().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) =>
      runOrQueue(ctx, "task.updateDates", input, async () => {
        const task = await ctx.db.task.findUniqueOrThrow({ where: { id: input.id } });
        await assertProjectMember(ctx.db, task.projectId, ctx.user.id);
        return ctx.db.task.update({
          where: { id: input.id },
          data: {
            ...(input.startDate !== undefined && { startDate: input.startDate }),
            ...(input.endDate !== undefined && { endDate: input.endDate }),
          },
        });
      }),
    ),

  // Full replace, not incremental add/remove — simplest semantics for a
  // small assignee list, matches how the web UI would drive a multi-select.
  updateAssignees: scopedProcedure("task", "write")
    .input(z.object({ id: z.string(), assigneeUserIds: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) =>
      runOrQueue(ctx, "task.updateAssignees", input, async () => {
        const task = await ctx.db.task.findUniqueOrThrow({ where: { id: input.id } });
        await assertProjectMember(ctx.db, task.projectId, ctx.user.id);
        const memberIds = await resolveAssigneeMemberIds(ctx.db, task.projectId, input.assigneeUserIds);
        await ctx.db.taskAssignee.deleteMany({ where: { taskId: input.id } });
        await ctx.db.taskAssignee.createMany({
          data: memberIds.map((projectMemberId) => ({ taskId: input.id, projectMemberId })),
        });
        return ctx.db.task.findUniqueOrThrow({
          where: { id: input.id },
          include: taskAssigneeInclude,
        });
      }),
    ),

  // Full replace, same semantics as updateAssignees — simplest contract
  // for a small tag list, matches how the web UI drives a multi-select.
  updateLabels: scopedProcedure("task", "write")
    .input(z.object({ id: z.string(), labelIds: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) =>
      runOrQueue(ctx, "task.updateLabels", input, async () => {
        const task = await ctx.db.task.findUniqueOrThrow({ where: { id: input.id } });
        await assertProjectMember(ctx.db, task.projectId, ctx.user.id);
        const labelIds = await resolveLabelIds(ctx.db, task.projectId, input.labelIds);
        await ctx.db.taskLabel.deleteMany({ where: { taskId: input.id } });
        await ctx.db.taskLabel.createMany({
          data: labelIds.map((labelId) => ({ taskId: input.id, labelId })),
        });
        return ctx.db.task.findUniqueOrThrow({
          where: { id: input.id },
          include: taskAssigneeInclude,
        });
      }),
    ),
});
