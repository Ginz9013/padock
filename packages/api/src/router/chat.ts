import { z } from "zod";
import { scopedProcedure, router } from "../trpc.ts";
import { publishEvent } from "../redis.ts";

// DM (recipientId) or channel message (channelId+topicId) — never
// both. §5.1.3/Phase 4. `projectId` is an optional tag on DMs only
// (§5.1.2); channel messages get project context from the channel.
const dmInput = z.object({
  recipientId: z.string(),
  content: z.string().min(1),
  projectId: z.string().optional(),
});
const channelInput = z.object({
  channelId: z.string(),
  topicId: z.string(),
  content: z.string().min(1),
});

export const chatRouter = router({
  send: scopedProcedure("chat", "write")
    .input(z.union([dmInput, channelInput]))
    .mutation(async ({ ctx, input }) => {
      const message =
        "recipientId" in input
          ? await ctx.db.chatMessage.create({
              data: {
                senderId: ctx.user.id,
                recipientId: input.recipientId,
                content: input.content,
                projectId: input.projectId,
              },
            })
          : await ctx.db.chatMessage.create({
              data: {
                senderId: ctx.user.id,
                channelId: input.channelId,
                topicId: input.topicId,
                content: input.content,
              },
            });

      await publishEvent({ type: "chat.message", message });
      return message;
    }),

  conversation: scopedProcedure("chat", "read")
    .input(z.object({ withUserId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.chatMessage.findMany({
        where: {
          OR: [
            { senderId: ctx.user.id, recipientId: input.withUserId },
            { senderId: input.withUserId, recipientId: ctx.user.id },
          ],
        },
        orderBy: { createdAt: "asc" },
      });
    }),

  history: scopedProcedure("chat", "read")
    .input(z.object({ channelId: z.string(), topicId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.chatMessage.findMany({
        where: { channelId: input.channelId, topicId: input.topicId },
        orderBy: { createdAt: "asc" },
      });
    }),

  // Most recent DM per counterpart — enough to see who's messaged you
  // without building real unread/thread tracking (explicitly out of
  // scope, §5.1.3). Explicitly DM-only: recipientId not null, so a
  // channel message the user sent doesn't leak into their DM inbox.
  inbox: scopedProcedure("chat", "read").query(async ({ ctx }) => {
    const messages = await ctx.db.chatMessage.findMany({
      where: {
        recipientId: { not: null },
        OR: [{ senderId: ctx.user.id }, { recipientId: ctx.user.id }],
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    const latestByCounterpart = new Map<string, (typeof messages)[number]>();
    for (const message of messages) {
      const counterpartId = message.senderId === ctx.user.id ? message.recipientId! : message.senderId;
      if (!latestByCounterpart.has(counterpartId)) {
        latestByCounterpart.set(counterpartId, message);
      }
    }
    return [...latestByCounterpart.values()];
  }),
});
