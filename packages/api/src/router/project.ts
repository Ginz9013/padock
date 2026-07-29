import { z } from "zod";
import { protectedProcedure, router } from "../trpc.ts";

// Single-tenant (CONTEXT.md §6): there is only ever one Organization,
// so Project creation just needs to find it, not resolve which org the
// caller belongs to.
export const projectRouter = router({
  create: protectedProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const org = await ctx.db.organization.findFirstOrThrow();
      return ctx.db.project.create({
        data: { name: input.name, organizationId: org.id },
      });
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.project.findMany({ orderBy: { createdAt: "desc" } });
  }),
});
