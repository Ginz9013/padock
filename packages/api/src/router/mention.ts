import { z } from "zod";
import { scopedProcedure, router } from "../trpc.ts";
import { conversationContextInput, resolveProjectAnchor } from "../mentionContext.ts";
import { assertProjectMember, listMemberProjectIds } from "../projectAccess.ts";

// Backs the chat composer's "@"/"#" pickers and the message list's
// read-time chip resolution (CONTEXT.md §5.1.20). Scoped under the
// existing "chat" PAT resource/read action — mentions are chat-adjacent
// behavior, not a new PAT-scopeable domain of their own.
export const mentionRouter = router({
  // "#" picker: project-anchor-first, membership-fallback search across
  // tasks + docs. `contains`/case-insensitive, not search.ts's
  // websearch_to_tsquery — this is a few-keystroke live typeahead, not a
  // search page, and short partial input behaves better with substring
  // matching than full-text word matching.
  search: scopedProcedure("chat", "read")
    .input(z.object({ context: conversationContextInput, query: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const anchorProjectId = await resolveProjectAnchor(ctx.db, ctx.user.id, input.context);
      const projectIds = anchorProjectId ? [anchorProjectId] : await listMemberProjectIds(ctx.db, ctx.user.id);
      if (projectIds.length === 0) return { crossProject: false, tasks: [], docs: [] };

      const [tasks, docs] = await Promise.all([
        ctx.db.task.findMany({
          where: { projectId: { in: projectIds }, title: { contains: input.query, mode: "insensitive" } },
          select: { id: true, title: true, projectId: true, project: { select: { name: true } } },
          orderBy: { title: "asc" },
          take: 6,
        }),
        ctx.db.doc.findMany({
          where: { projectId: { in: projectIds }, title: { contains: input.query, mode: "insensitive" } },
          select: { id: true, title: true, projectId: true, project: { select: { name: true } } },
          orderBy: { title: "asc" },
          take: 6,
        }),
      ]);

      return {
        // Drives the picker's project-name badge — only shown when
        // results could span multiple projects (no single anchor).
        crossProject: anchorProjectId === null,
        tasks: tasks.map((t) => ({ id: t.id, title: t.title, projectId: t.projectId, projectName: t.project.name })),
        docs: docs.map((d) => ({ id: d.id, title: d.title, projectId: d.projectId, projectName: d.project.name })),
      };
    }),

  // "@" picker: candidates scoped to who can already see this
  // conversation (§5.1.20) — a project-scoped channel offers only that
  // project's members, a global channel offers the whole org (matching
  // its existing open-read model), a DM offers only the other
  // participant.
  userCandidates: scopedProcedure("chat", "read")
    .input(z.object({ context: conversationContextInput }))
    .query(async ({ ctx, input }) => {
      if ("channelId" in input.context) {
        const channel = await ctx.db.channel.findUniqueOrThrow({ where: { id: input.context.channelId } });
        if (channel.projectId) {
          await assertProjectMember(ctx.db, channel.projectId, ctx.user.id);
          const members = await ctx.db.projectMember.findMany({
            where: { projectId: channel.projectId },
            include: { user: { select: { id: true, name: true, email: true, image: true } } },
          });
          return members.map((m) => m.user);
        }
        return ctx.db.user.findMany({
          select: { id: true, name: true, email: true, image: true },
          orderBy: { name: "asc" },
        });
      }
      const recipient = await ctx.db.user.findUniqueOrThrow({
        where: { id: input.context.recipientId },
        select: { id: true, name: true, email: true, image: true },
      });
      return [recipient];
    }),

  // Batch, read-time, per-viewer-permission-filtered resolution of
  // ChatMention rows for a set of messages (§5.1.20) — called by the
  // message list after fetching history/conversation, and again per
  // message on realtime receipt, since resolution is viewer-specific
  // and can't ride along in the broadcast payload.
  resolve: scopedProcedure("chat", "read")
    .input(z.object({ messageIds: z.array(z.string()).min(1).max(200) }))
    .query(async ({ ctx, input }) => {
      const memberProjectIds = await listMemberProjectIds(ctx.db, ctx.user.id);
      const memberSet = new Set(memberProjectIds);

      // Authorization gate: only resolve mentions for messages the
      // caller could already read via chat.history/conversation — don't
      // trust client-supplied messageIds blindly, or a malicious client
      // could probe ChatMention rows for a DM/private channel it isn't
      // part of.
      const mentions = await ctx.db.chatMention.findMany({
        where: {
          chatMessageId: { in: input.messageIds },
          chatMessage: {
            OR: [
              { senderId: ctx.user.id },
              { recipientId: ctx.user.id },
              { channel: { projectId: null } },
              { channel: { projectId: { in: memberProjectIds } } },
            ],
          },
        },
      });
      if (mentions.length === 0) return [];

      const ids = {
        user: mentions.filter((m) => m.targetType === "user").map((m) => m.targetId),
        task: mentions.filter((m) => m.targetType === "task").map((m) => m.targetId),
        doc: mentions.filter((m) => m.targetType === "doc").map((m) => m.targetId),
      };
      const [users, tasks, docs] = await Promise.all([
        ids.user.length
          ? ctx.db.user.findMany({ where: { id: { in: ids.user } }, select: { id: true, name: true } })
          : [],
        ids.task.length
          ? ctx.db.task.findMany({
              where: { id: { in: ids.task } },
              select: { id: true, title: true, projectId: true },
            })
          : [],
        ids.doc.length
          ? ctx.db.doc.findMany({ where: { id: { in: ids.doc } }, select: { id: true, title: true, projectId: true } })
          : [],
      ]);
      const userMap = new Map(users.map((u) => [u.id, u]));
      const taskMap = new Map(tasks.map((t) => [t.id, t]));
      const docMap = new Map(docs.map((d) => [d.id, d]));

      return mentions.map((m) => {
        if (m.targetType === "user") {
          const u = userMap.get(m.targetId);
          return {
            chatMessageId: m.chatMessageId,
            targetType: "user" as const,
            targetId: m.targetId,
            title: u?.name ?? null,
            projectId: null,
            restricted: false,
          };
        }
        const item = m.targetType === "task" ? taskMap.get(m.targetId) : docMap.get(m.targetId);
        if (!item) {
          return {
            chatMessageId: m.chatMessageId,
            targetType: m.targetType,
            targetId: m.targetId,
            title: null,
            projectId: null,
            restricted: false,
          };
        }
        // A reader who isn't a member of the mentioned task/doc's own
        // project gets an anonymized placeholder, not the real title —
        // closes the leak that compose-time scoping above doesn't
        // cover: a global channel is open to the whole org, so a task
        // mentioned from a project the sender belongs to could
        // otherwise render its (possibly sensitive) title to every
        // reader regardless of their own project membership.
        const restricted = !memberSet.has(item.projectId);
        return {
          chatMessageId: m.chatMessageId,
          targetType: m.targetType,
          targetId: m.targetId,
          title: restricted ? null : item.title,
          projectId: restricted ? null : item.projectId,
          restricted,
        };
      });
    }),
});
