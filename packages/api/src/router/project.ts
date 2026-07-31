import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { scopedProcedure, router } from "../trpc.ts";
import { runOrQueue } from "../approvalGate.ts";
import { assertKeepsAnAdmin, assertProjectAdmin, assertProjectMember } from "../projectAccess.ts";

// Plane-style default workflow (CONTEXT.md §5.1.5) — seeded on every
// new project so it's immediately usable, not stuck with zero valid
// task states. Projects can add their own states beyond these.
const DEFAULT_TASK_STATES = [
  { name: "Backlog", group: "backlog" as const },
  { name: "Todo", group: "unstarted" as const, isDefault: true },
  { name: "In Progress", group: "started" as const },
  { name: "In Review", group: "started" as const },
  { name: "Done", group: "completed" as const },
  { name: "Cancelled", group: "cancelled" as const },
];

// Single-tenant (CONTEXT.md §6): there is only ever one Organization,
// so Project creation just needs to find it, not resolve which org the
// caller belongs to.
export const projectRouter = router({
  create: scopedProcedure("project", "write")
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) =>
      runOrQueue(ctx, "project.create", input, async () => {
        const org = await ctx.db.organization.findFirstOrThrow();
        const project = await ctx.db.project.create({
          data: {
            name: input.name,
            organizationId: org.id,
            createdById: ctx.user.id,
            members: {
              create: { userId: ctx.user.id, role: "admin" },
            },
          },
        });
        await ctx.db.taskState.createMany({
          data: DEFAULT_TASK_STATES.map((s, position) => ({
            projectId: project.id,
            name: s.name,
            group: s.group,
            position,
            isDefault: s.isDefault ?? false,
          })),
        });
        // The project's default "project channel" (CONTEXT.md §5.1.10) —
        // same immediately-usable rationale as the task states above.
        await ctx.db.channel.create({
          data: {
            title: project.name,
            projectId: project.id,
            isDefault: true,
            createdById: ctx.user.id,
          },
        });
        return project;
      }),
    ),

  // Only returns projects the caller is a ProjectMember of. `task` now
  // carries the same membership check (projectAccess.ts); doc/channel/chat
  // still don't (§7-deferred) — a non-member can still reach those by id.
  list: scopedProcedure("project", "read").query(async ({ ctx }) => {
    return ctx.db.project.findMany({
      where: { members: { some: { userId: ctx.user.id } } },
      orderBy: { createdAt: "desc" },
    });
  }),

  listMembers: scopedProcedure("project", "read")
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertProjectMember(ctx.db, input.projectId, ctx.user.id);
      return ctx.db.projectMember.findMany({
        where: { projectId: input.projectId },
        include: { user: true },
        orderBy: { createdAt: "asc" },
      });
    }),

  addMember: scopedProcedure("project", "write")
    .input(
      z.object({
        projectId: z.string(),
        userId: z.string(),
        role: z.enum(["admin", "member"]).default("member"),
      }),
    )
    .mutation(async ({ ctx, input }) =>
      runOrQueue(ctx, "project.addMember", input, async () => {
        await assertProjectAdmin(ctx.db, input.projectId, ctx.user.id);
        const targetUser = await ctx.db.user.findUnique({ where: { id: input.userId } });
        if (!targetUser) {
          throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
        }
        const existing = await ctx.db.projectMember.findUnique({
          where: { projectId_userId: { projectId: input.projectId, userId: input.userId } },
        });
        if (existing?.role === "admin" && input.role === "member") {
          await assertKeepsAnAdmin(ctx.db, input.projectId);
        }
        return ctx.db.projectMember.upsert({
          where: { projectId_userId: { projectId: input.projectId, userId: input.userId } },
          create: { projectId: input.projectId, userId: input.userId, role: input.role },
          update: { role: input.role },
        });
      }),
    ),

  // Refuses to remove a project's last admin — an admin-less project
  // could never have its membership managed again.
  removeMember: scopedProcedure("project", "write")
    .input(z.object({ projectId: z.string(), userId: z.string() }))
    .mutation(async ({ ctx, input }) =>
      runOrQueue(ctx, "project.removeMember", input, async () => {
        await assertProjectAdmin(ctx.db, input.projectId, ctx.user.id);
        const target = await ctx.db.projectMember.findUnique({
          where: { projectId_userId: { projectId: input.projectId, userId: input.userId } },
        });
        if (!target) {
          throw new TRPCError({ code: "NOT_FOUND", message: "User is not a member of this project" });
        }
        if (target.role === "admin") {
          await assertKeepsAnAdmin(ctx.db, input.projectId);
        }
        return ctx.db.projectMember.delete({
          where: { projectId_userId: { projectId: input.projectId, userId: input.userId } },
        });
      }),
    ),
});
