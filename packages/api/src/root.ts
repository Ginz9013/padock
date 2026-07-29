import { router, publicProcedure, protectedProcedure } from "./trpc.ts";

// Phase 0 placeholder — proves the tRPC + auth + db wiring boots end to
// end. Chat/task/doc routers land in Phase 1 (CONTEXT.md §9).
export const appRouter = router({
  health: publicProcedure.query(async ({ ctx }) => {
    await ctx.db.$queryRaw`SELECT 1`;
    return { ok: true as const };
  }),
  whoami: protectedProcedure.query(({ ctx }) => {
    return { id: ctx.user.id, email: ctx.user.email, name: ctx.user.name };
  }),
});

export type AppRouter = typeof appRouter;
