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
import { docAttributeRouter } from "./router/docAttribute.ts";
import { apikeyRouter } from "./router/apikey.ts";
import { approvalRouter } from "./router/approval.ts";
import { auditLogRouter } from "./router/auditLog.ts";
import { notificationRouter } from "./router/notification.ts";
import { mentionRouter } from "./router/mention.ts";
import { bookmarkRouter } from "./router/bookmark.ts";

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
  docAttribute: docAttributeRouter,
  apikey: apikeyRouter,
  approval: approvalRouter,
  auditLog: auditLogRouter,
  notification: notificationRouter,
  mention: mentionRouter,
  bookmark: bookmarkRouter,
});

export type AppRouter = typeof appRouter;
