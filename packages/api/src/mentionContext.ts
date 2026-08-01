import { z } from "zod";
import type { PrismaClient } from "@padock/db";
import { assertProjectMember } from "./projectAccess.ts";

// Mirrors chat.ts's own dmInput/channelInput discriminated-union shape
// so callers (mention.search/userCandidates) can describe "which
// conversation is this picker mounted in" the same way chat.send
// already does.
export const conversationContextInput = z.union([
  z.object({ channelId: z.string() }),
  z.object({ recipientId: z.string(), projectId: z.string().optional() }),
]);
export type ConversationContext = z.infer<typeof conversationContextInput>;

// Resolves the project anchor for a conversation (CONTEXT.md §5.1.20):
// a project-scoped channel's own projectId, or a DM's optional
// projectId tag. Asserts membership whenever an anchor exists, same as
// chat.send/chat.history already do for their own channel/DM branches.
export async function resolveProjectAnchor(
  db: PrismaClient,
  userId: string,
  context: ConversationContext,
): Promise<string | null> {
  if ("channelId" in context) {
    const channel = await db.channel.findUniqueOrThrow({ where: { id: context.channelId } });
    if (channel.projectId) await assertProjectMember(db, channel.projectId, userId);
    return channel.projectId;
  }
  if (context.projectId) await assertProjectMember(db, context.projectId, userId);
  return context.projectId ?? null;
}
