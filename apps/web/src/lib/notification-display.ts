// Hand-written rather than derived from AppRouter's inferred return type
// — same TS2589 recursion-limit workaround the approvals page's
// ApprovalRequest type already uses (apps/web/src/app/(app)/approvals/page.tsx).
export type NotificationItem = {
  id: string;
  type: "task_assigned" | "project_member_added" | "chat_dm" | "chat_mention";
  isRead: boolean;
  createdAt: string;
  taskId: string | null;
  projectId: string | null;
  actor: { id: string; name: string; email: string } | null;
  task: { id: string; title: string } | null;
  project: { id: string; name: string } | null;
  chatMessage: { id: string; content: string; channelId: string | null } | null;
};

export function describeNotification(n: NotificationItem): string {
  const actorName = n.actor?.name ?? "Someone";
  switch (n.type) {
    case "task_assigned":
      return `${actorName} assigned you to "${n.task?.title ?? "a task"}"`;
    case "project_member_added":
      return `${actorName} added you to "${n.project?.name ?? "a project"}"`;
    case "chat_dm":
      return `${actorName} sent you a message`;
    case "chat_mention":
      return `${actorName} mentioned you`;
  }
}

// task_assigned uses a real deep link — the project task page reads
// ?taskId= and auto-opens the Task Detail Modal (apps/web/src/app/(app)/
// projects/[id]/page.tsx), the same query-param pattern it already uses
// for ?view=. chat_dm links to /chat/[userId] (apps/web/src/app/(app)/
// chat/[userId]/page.tsx) — the notification's `actor` is always the
// message's sender (chat.ts sets actorId to the sender when notifying
// the recipient), which is exactly the DM counterpart this recipient
// wants to land on. chat_mention follows the same actor-is-the-author
// rule (chat.ts's mention fan-out uses actorId: ctx.user.id too, same as
// chat_dm) — it can originate from either a DM or a channel message, so
// it branches on chatMessage.channelId first to link to the right one.
export function notificationHref(n: NotificationItem): string | null {
  switch (n.type) {
    case "task_assigned":
      return n.projectId && n.taskId ? `/projects/${n.projectId}?taskId=${n.taskId}` : null;
    case "project_member_added":
      return n.projectId ? `/projects/${n.projectId}/overview` : null;
    case "chat_dm":
      return n.actor ? `/chat/${n.actor.id}` : null;
    case "chat_mention":
      return n.chatMessage?.channelId
        ? `/chat/channel/${n.chatMessage.channelId}`
        : n.actor
          ? `/chat/${n.actor.id}`
          : null;
  }
}
