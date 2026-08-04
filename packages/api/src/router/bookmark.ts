import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { scopedProcedure, router } from "../trpc.ts";
import { listMemberProjectIds } from "../projectAccess.ts";

// Private per-user "save this message for myself" marker (§5.1.22) —
// not a shared/team-visible pin, so nothing here is observable by
// anyone but the bookmarking user. Scoped under the existing "chat"
// PAT resource, same posture as mention.ts: bookmarking is chat-adjacent
// behavior, not a new PAT-scopeable domain of its own.
export const bookmarkRouter = router({
  add: scopedProcedure("chat", "write")
    .input(z.object({ chatMessageId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const memberProjectIds = await listMemberProjectIds(ctx.db, ctx.user.id);
      // Same read-access gate as mention.resolve/chat.resolveQuotes —
      // don't let a bookmark be created for a message the caller
      // couldn't otherwise read.
      const message = await ctx.db.chatMessage.findFirst({
        where: {
          id: input.chatMessageId,
          OR: [
            { senderId: ctx.user.id },
            { recipientId: ctx.user.id },
            { channel: { projectId: null } },
            { channel: { projectId: { in: memberProjectIds } } },
          ],
        },
        select: { id: true },
      });
      if (!message) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Message not found" });
      }

      // Idempotent — re-bookmarking an already-bookmarked message is a
      // no-op, not an error (the unique constraint would otherwise
      // reject a double-click of the same star button).
      return ctx.db.chatBookmark.upsert({
        where: { userId_chatMessageId: { userId: ctx.user.id, chatMessageId: input.chatMessageId } },
        create: { userId: ctx.user.id, chatMessageId: input.chatMessageId },
        update: {},
      });
    }),

  remove: scopedProcedure("chat", "write")
    .input(z.object({ chatMessageId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.chatBookmark.deleteMany({
        where: { userId: ctx.user.id, chatMessageId: input.chatMessageId },
      });
      return { ok: true as const };
    }),

  // Flat personal list — one global /bookmarks page, no project-scoped
  // duplicate (§5.1.22). Messages belonging to a project channel the
  // caller is no longer a ProjectMember of are silently omitted, not
  // shown as restricted: unlike a mention chip rendered inline in a
  // conversation others are reading, this list exists only for the
  // caller, so a shorter list is the cleaner behavior.
  list: scopedProcedure("chat", "read").query(async ({ ctx }) => {
    const memberProjectIds = await listMemberProjectIds(ctx.db, ctx.user.id);
    const memberSet = new Set(memberProjectIds);

    const bookmarks = await ctx.db.chatBookmark.findMany({
      where: { userId: ctx.user.id },
      orderBy: { createdAt: "desc" },
      include: {
        chatMessage: {
          select: {
            id: true,
            content: true,
            senderId: true,
            recipientId: true,
            createdAt: true,
            channelId: true,
            channel: { select: { title: true, projectId: true } },
          },
        },
      },
    });

    return bookmarks
      .filter((b) => !b.chatMessage.channel?.projectId || memberSet.has(b.chatMessage.channel.projectId))
      .map((b) => ({
        bookmarkedAt: b.createdAt,
        chatMessageId: b.chatMessage.id,
        content: b.chatMessage.content,
        senderId: b.chatMessage.senderId,
        recipientId: b.chatMessage.recipientId,
        createdAt: b.chatMessage.createdAt,
        channelId: b.chatMessage.channelId,
        channelTitle: b.chatMessage.channel?.title ?? null,
        projectId: b.chatMessage.channel?.projectId ?? null,
      }));
  }),
});
