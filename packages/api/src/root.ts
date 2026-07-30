import { router, publicProcedure, protectedProcedure } from "./trpc.ts";
import { projectRouter } from "./router/project.ts";
import { taskRouter } from "./router/task.ts";
import { docRouter } from "./router/doc.ts";
import { chatRouter } from "./router/chat.ts";
import { userRouter } from "./router/user.ts";
import { searchRouter } from "./router/search.ts";
import { channelRouter } from "./router/channel.ts";
import { taskStateRouter } from "./router/taskState.ts";
import { labelRouter } from "./router/label.ts";
import { apikeyRouter } from "./router/apikey.ts";
import { approvalRouter } from "./router/approval.ts";

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
  channel: channelRouter,
  taskState: taskStateRouter,
  label: labelRouter,
  apikey: apikeyRouter,
  approval: approvalRouter,
});

export type AppRouter = typeof appRouter;
