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
          data: { name: input.name, organizationId: org.id },
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
        return project;
      }),
    ),

  list: scopedProcedure("project", "read").query(async ({ ctx }) => {
    return ctx.db.project.findMany({ orderBy: { createdAt: "desc" } });
  }),
});
