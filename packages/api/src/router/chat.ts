import { z } from "zod";
import { scopedProcedure, router } from "../trpc.ts";
import { publishEvent } from "../redis.ts";
import { runOrQueue } from "../approvalGate.ts";
import { assertProjectMember } from "../projectAccess.ts";
import { notify } from "../notify.ts";

// DM (recipientId) or channel message (channelId) — never both.
// §5.1.3/Phase 4, single-level channel per ADR-0001. `projectId` is an
// optional tag on DMs only (§5.1.2); channel messages get project
// context from the channel.
const dmInput = z.object({
  recipientId: z.string(),
  content: z.string().min(1),
  projectId: z.string().optional(),
});
const channelInput = z.object({
  channelId: z.string(),
  content: z.string().min(1),
});

export const chatRouter = router({
  send: scopedProcedure("chat", "write")
    .input(z.union([dmInput, channelInput]))
    .mutation(async ({ ctx, input }) =>
      runOrQueue(ctx, "chat.send", input, async () => {
        if ("recipientId" in input) {
          if (input.projectId) {
            await assertProjectMember(ctx.db, input.projectId, ctx.user.id);
          }
        } else {
          const channel = await ctx.db.channel.findUniqueOrThrow({ where: { id: input.channelId } });
          if (channel.projectId) {
            await assertProjectMember(ctx.db, channel.projectId, ctx.user.id);
          }
        }

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
                  content: input.content,
                },
              });

        await publishEvent({ type: "chat.message", recipientUserIds: "broadcast", payload: { message } });

        if ("recipientId" in input) {
          await notify(ctx.db, {
            userId: input.recipientId,
            type: "chat_dm",
            chatMessageId: message.id,
            actorId: ctx.user.id,
          });
        }

        return message;
      }),
    ),

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
    .input(z.object({ channelId: z.string() }))
    .query(async ({ ctx, input }) => {
      const channel = await ctx.db.channel.findUniqueOrThrow({ where: { id: input.channelId } });
      if (channel.projectId) {
        await assertProjectMember(ctx.db, channel.projectId, ctx.user.id);
      }
      return ctx.db.chatMessage.findMany({
        where: { channelId: input.channelId },
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
