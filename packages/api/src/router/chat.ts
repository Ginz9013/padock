import { z } from "zod";
import { protectedProcedure, router } from "../trpc.ts";

// Point-to-point DM only, no channels/threads/unread state — CONTEXT.md
// §5.1.3. `projectId` is an optional tag (§5.1.2), not a channel.
export const chatRouter = router({
  send: protectedProcedure
    .input(
      z.object({
        recipientId: z.string(),
        content: z.string().min(1),
        projectId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.chatMessage.create({
        data: {
          senderId: ctx.user.id,
          recipientId: input.recipientId,
          content: input.content,
          projectId: input.projectId,
        },
      });
    }),

  conversation: protectedProcedure
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

  // Most recent message per counterpart — enough to see who's messaged
  // you without building real unread/thread tracking (explicitly out
  // of scope, §5.1.3).
  inbox: protectedProcedure.query(async ({ ctx }) => {
    const messages = await ctx.db.chatMessage.findMany({
      where: { OR: [{ senderId: ctx.user.id }, { recipientId: ctx.user.id }] },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    const latestByCounterpart = new Map<string, (typeof messages)[number]>();
    for (const message of messages) {
      const counterpartId = message.senderId === ctx.user.id ? message.recipientId : message.senderId;
      if (!latestByCounterpart.has(counterpartId)) {
        latestByCounterpart.set(counterpartId, message);
      }
    }
    return [...latestByCounterpart.values()];
  }),
});
