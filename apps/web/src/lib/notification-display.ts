// Hand-written rather than derived from AppRouter's inferred return type
// — same TS2589 recursion-limit workaround the approvals page's
// ApprovalRequest type already uses (apps/web/src/app/(app)/approvals/page.tsx).
export type NotificationItem = {
  id: string;
  type: "task_assigned" | "project_member_added" | "chat_dm";
  isRead: boolean;
  createdAt: string;
  taskId: string | null;
  projectId: string | null;
  actor: { id: string; name: string; email: string } | null;
  task: { id: string; title: string } | null;
  project: { id: string; name: string } | null;
  chatMessage: { id: string; content: string } | null;
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
  }
}

// Best available navigation target — none of these are true deep links
// to the exact task/message (the web UI has no per-task URL, tasks open
// via a modal triggered from within the project page), just the closest
// page that gets a user to the right context.
export function notificationHref(n: NotificationItem): string | null {
  switch (n.type) {
    case "task_assigned":
      return n.projectId ? `/projects/${n.projectId}` : null;
    case "project_member_added":
      return n.projectId ? `/projects/${n.projectId}/overview` : null;
    case "chat_dm":
      return "/dashboard";
  }
}
