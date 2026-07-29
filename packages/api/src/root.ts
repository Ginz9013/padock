import { router, publicProcedure, protectedProcedure } from "./trpc.ts";
import { projectRouter } from "./router/project.ts";
import { taskRouter } from "./router/task.ts";
import { docRouter } from "./router/doc.ts";
import { chatRouter } from "./router/chat.ts";
import { userRouter } from "./router/user.ts";
import { searchRouter } from "./router/search.ts";

export const appRouter = router({
  health: publicProcedure.query(async ({ ctx }) => {
    await ctx.db.$queryRaw`SELECT 1`;
    return { ok: true as const };
  }),
  whoami: protectedProcedure.query(({ ctx }) => {
    return { id: ctx.user.id, email: ctx.user.email, name: ctx.user.name };
  }),
  project: projectRouter,
  task: taskRouter,
  doc: docRouter,
  chat: chatRouter,
  user: userRouter,
  search: searchRouter,
});

export type AppRouter = typeof appRouter;
