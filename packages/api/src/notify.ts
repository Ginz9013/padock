import type { PrismaClient } from "@padock/db";
import { publishEvent } from "./redis.ts";

// Mirrors the NotificationType enum's values (schema.prisma) as a plain
// string union — same "zod/local literal union, not an imported Prisma
// enum type" convention task.ts's priorityEnum already uses.
export type NotificationType = "task_assigned" | "project_member_added" | "chat_dm" | "chat_mention";

/**
 * Cross-domain notification system (CONTEXT.md §5.1.19, ADR-0002).
 * Shared by every trigger point instead of each router writing its own
 * Notification row + publishEvent call, matching this codebase's
 * standing convention (assertProjectMember, runOrQueue, publishEvent
 * itself). Writes the Notification row unconditionally — the recipient
 * being offline never blocks or defers this — then makes a best-effort
 * push through the same targeted realtime routing markRead uses. The
 * DB row is the durability source of truth; the push is only a
 * best-effort "something changed" signal for whoever is connected
 * right now.
 */
export async function notify(
  db: PrismaClient,
  params: {
    userId: string;
    type: NotificationType;
    taskId?: string;
    projectId?: string;
    chatMessageId?: string;
    actorId?: string;
  },
): Promise<void> {
  // Acting on your own behalf never notifies you — assigning yourself
  // a task you created, or DMing yourself, isn't "something happened
  // you should be told about."
  if (params.actorId && params.actorId === params.userId) return;

  const notification = await db.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      taskId: params.taskId,
      projectId: params.projectId,
      chatMessageId: params.chatMessageId,
      actorId: params.actorId,
    },
  });

  await publishEvent({
    type: "notification.created",
    recipientUserIds: [params.userId],
    payload: { notification },
  });
}
