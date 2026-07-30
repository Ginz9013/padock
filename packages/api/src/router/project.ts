import { z } from "zod";
import { scopedProcedure, router } from "../trpc.ts";
import { runOrQueue } from "../approvalGate.ts";

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

  // Only returns projects the caller is a ProjectMember of (§7-deferred:
  // the same membership check still needs adding to task/doc/channel/chat
  // routers so a non-member can't reach a hidden project's data directly
  // by id — this pass only covers the project list itself).
  list: scopedProcedure("project", "read").query(async ({ ctx }) => {
    return ctx.db.project.findMany({
      where: { members: { some: { userId: ctx.user.id } } },
      orderBy: { createdAt: "desc" },
    });
  }),
});
