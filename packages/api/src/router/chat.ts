import { z } from "zod";
import { scopedProcedure, router } from "../trpc.ts";
import { publishEvent } from "../redis.ts";
import { runOrQueue } from "../approvalGate.ts";
import { assertProjectMember, listMemberProjectIds } from "../projectAccess.ts";
import { notify } from "../notify.ts";
import { parseMentions } from "../mentions.ts";
import { TRPCError } from "@trpc/server";

// DM (recipientId) or channel message (channelId) — never both.
// §5.1.3/Phase 4, single-level channel per ADR-0001. `projectId` is an
// optional tag on DMs only (§5.1.2); channel messages get project
// context from the channel. `quotedMessageId` (§5.1.23) is same-thread
// only — validated against whichever branch this input takes, below.
const dmInput = z.object({
  recipientId: z.string(),
  content: z.string().min(1),
  projectId: z.string().optional(),
  quotedMessageId: z.string().optional(),
});
const channelInput = z.object({
  channelId: z.string(),
  content: z.string().min(1),
  quotedMessageId: z.string().optional(),
});

// §5.1.23: a quote must reference a message in the exact same
// conversation being sent to — a mismatch can only come from a
// tampered/buggy client (the UI only ever offers "quote" on messages
// already visible in the current thread), so this rejects the whole
// send rather than silently dropping the quote the way an invalid
// ChatMention token is filtered out.
async function assertSameThread(
  db: Parameters<typeof assertProjectMember>[0],
  quotedMessageId: string,
  input: { recipientId: string } | { channelId: string },
  userId: string,
) {
  const quoted = await db.chatMessage.findUnique({ where: { id: quotedMessageId } });
  if (!quoted) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Quoted message not found" });
  }
  const sameThread =
    "recipientId" in input
      ? quoted.recipientId !== null &&
        ((quoted.senderId === userId && quoted.recipientId === input.recipientId) ||
          (quoted.senderId === input.recipientId && quoted.recipientId === userId))
      : quoted.channelId === input.channelId;
  if (!sameThread) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Can only quote a message from the same conversation" });
  }
}

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

        if (input.quotedMessageId) {
          await assertSameThread(ctx.db, input.quotedMessageId, input, ctx.user.id);
        }

        const message =
          "recipientId" in input
            ? await ctx.db.chatMessage.create({
                data: {
                  senderId: ctx.user.id,
                  recipientId: input.recipientId,
                  content: input.content,
                  projectId: input.projectId,
                  quotedMessageId: input.quotedMessageId,
                },
              })
            : await ctx.db.chatMessage.create({
                data: {
                  senderId: ctx.user.id,
                  channelId: input.channelId,
                  content: input.content,
                  quotedMessageId: input.quotedMessageId,
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

        // @user/#task/#doc mentions (CONTEXT.md §5.1.20) — applies to
        // both DM and channel messages, unlike chat_dm above which is
        // DM-only. ChatMention rows are the queryable "who/what was
        // mentioned" source (notify() fan-out here, and mention.resolve's
        // read-time rendering); content itself only carries the raw
        // tokens for display reconstruction.
        const tokens = parseMentions(input.content);
        if (tokens.length > 0) {
          const byType = {
            user: tokens.filter((t) => t.type === "user").map((t) => t.id),
            task: tokens.filter((t) => t.type === "task").map((t) => t.id),
            doc: tokens.filter((t) => t.type === "doc").map((t) => t.id),
          };
          // Existence-validate before writing ChatMention/calling
          // notify() — an unvalidated stale/forged token would
          // otherwise hit notify()'s real FK on Notification.userId
          // and fail the whole send, not just skip the mention.
          const [validUsers, validTasks, validDocs] = await Promise.all([
            byType.user.length
              ? ctx.db.user.findMany({ where: { id: { in: byType.user } }, select: { id: true } })
              : [],
            byType.task.length
              ? ctx.db.task.findMany({ where: { id: { in: byType.task } }, select: { id: true } })
              : [],
            byType.doc.length
              ? ctx.db.doc.findMany({ where: { id: { in: byType.doc } }, select: { id: true } })
              : [],
          ]);
          const validIds = {
            user: new Set(validUsers.map((u) => u.id)),
            task: new Set(validTasks.map((t) => t.id)),
            doc: new Set(validDocs.map((d) => d.id)),
          };
          const validTokens = tokens.filter((t) => validIds[t.type].has(t.id));

          if (validTokens.length > 0) {
            await ctx.db.chatMention.createMany({
              data: validTokens.map((t) => ({ chatMessageId: message.id, targetType: t.type, targetId: t.id })),
            });
          }
          for (const t of validTokens) {
            if (t.type !== "user") continue; // #task/#doc never notify — link-only (§5.1.20)
            await notify(ctx.db, {
              userId: t.id,
              type: "chat_mention",
              chatMessageId: message.id,
              actorId: ctx.user.id,
            });
          }
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

  // Batch, read-time resolution of quoted messages (§5.1.23), parallel
  // in shape to mention.resolve. Id-only reference, no content/sender
  // snapshot taken at send time — resolved live here instead, so a
  // rename or an access change is always reflected, never stale.
  resolveQuotes: scopedProcedure("chat", "read")
    .input(z.object({ messageIds: z.array(z.string()).min(1).max(200) }))
    .query(async ({ ctx, input }) => {
      const memberProjectIds = await listMemberProjectIds(ctx.db, ctx.user.id);
      const memberSet = new Set(memberProjectIds);

      // Authorization gate: only resolve quotes for messages the caller
      // could already read via chat.history/conversation — same posture
      // as mention.resolve, don't trust client-supplied messageIds blindly.
      const quoting = await ctx.db.chatMessage.findMany({
        where: {
          id: { in: input.messageIds },
          quotedMessageId: { not: null },
          OR: [
            { senderId: ctx.user.id },
            { recipientId: ctx.user.id },
            { channel: { projectId: null } },
            { channel: { projectId: { in: memberProjectIds } } },
          ],
        },
        select: { id: true, quotedMessageId: true },
      });
      if (quoting.length === 0) return [];

      const quotedIds = quoting.map((m) => m.quotedMessageId!);
      const quoted = await ctx.db.chatMessage.findMany({
        where: { id: { in: quotedIds } },
        select: {
          id: true,
          content: true,
          senderId: true,
          createdAt: true,
          channelId: true,
          channel: { select: { projectId: true } },
        },
      });
      const quotedMap = new Map(quoted.map((m) => [m.id, m]));

      return quoting.map((m) => {
        const target = quotedMap.get(m.quotedMessageId!);
        if (!target) {
          return { chatMessageId: m.id, quotedMessageId: m.quotedMessageId!, content: null, senderId: null, createdAt: null, restricted: false };
        }
        // Same project-membership gate as the underlying message read
        // (§5.1.13) — a viewer who has since lost access to the quoted
        // message's project gets a restricted placeholder, the same
        // rendering convention as §5.1.20's restricted #task/#doc chips.
        const restricted = !!target.channel?.projectId && !memberSet.has(target.channel.projectId);
        return {
          chatMessageId: m.id,
          quotedMessageId: target.id,
          content: restricted ? null : target.content,
          senderId: restricted ? null : target.senderId,
          createdAt: restricted ? null : target.createdAt,
          restricted,
        };
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
