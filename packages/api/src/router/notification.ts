import { z } from "zod";
import { scopedProcedure, router } from "../trpc.ts";
import { publishEvent } from "../redis.ts";

// Rendering a notification ("Alice assigned you to 'Fix login bug'")
// needs the related entities' display fields, not just their ids —
// select just the display-relevant columns rather than the full row.
const notificationInclude = {
  actor: { select: { id: true, name: true, email: true } },
  task: { select: { id: true, title: true } },
  project: { select: { id: true, name: true } },
  chatMessage: { select: { id: true, content: true, channelId: true } },
} as const;

// First real cursor-paginated query in this codebase (§5.1.19) — every
// other list query (chat.inbox, approval.list) is a flat take:N with no
// cursor at all. Deliberate here: unlike those, a notification center
// is expected to support scrolling back through real history.
export const notificationRouter = router({
  list: scopedProcedure("notification", "read")
    .input(z.object({ cursor: z.string().optional(), limit: z.number().min(1).max(100).default(20) }))
    .query(async ({ ctx, input }) => {
      const items = await ctx.db.notification.findMany({
        where: { userId: ctx.user.id },
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        include: notificationInclude,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      });
      let nextCursor: string | undefined;
      if (items.length > input.limit) {
        nextCursor = items.pop()!.id;
      }
      return { items, nextCursor };
    }),

  // A genuine count() query, not derived from `list`'s (possibly
  // truncated) page — otherwise the badge would under-count once a
  // user has more unread items than one page holds.
  unreadCount: scopedProcedure("notification", "read").query(async ({ ctx }) => {
    return ctx.db.notification.count({ where: { userId: ctx.user.id, isRead: false } });
  }),

  markRead: scopedProcedure("notification", "write")
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const notification = await ctx.db.notification.update({
        where: { id: input.id, userId: ctx.user.id },
        data: { isRead: true, readAt: new Date() },
      });

      // Syncs every other open tab/device for this same user (§5.1.19) —
      // including the tab that triggered this call, so all of them
      // converge on the same local unread count from one code path.
      await publishEvent({
        type: "notification.read",
        recipientUserIds: [ctx.user.id],
        payload: { notificationId: notification.id },
      });

      return notification;
    }),

  markAllRead: scopedProcedure("notification", "write").mutation(async ({ ctx }) => {
    await ctx.db.notification.updateMany({
      where: { userId: ctx.user.id, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });

    await publishEvent({
      type: "notification.read",
      recipientUserIds: [ctx.user.id],
      payload: { notificationId: null },
    });
  }),
});
