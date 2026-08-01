"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";

import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { useSession } from "@/lib/auth-client";
import { useRealtimeEvent } from "@/lib/use-realtime";
import type { RealtimeEvent } from "@/lib/realtime";
import type { UserProfile } from "@/lib/use-user-profiles";
import { segmentContent, mightContainMention } from "@/lib/mention-tokens";
import ChatComposer from "./chat-composer-lazy";

type ChatMessage = {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
};

type IncomingChatMessage = ChatMessage & {
  recipientId: string | null;
  channelId: string | null;
};

// mention.resolve's per-viewer-filtered output (CONTEXT.md §5.1.20) —
// title/projectId are null when restricted (viewer isn't a member of
// the mentioned task/doc's project) or when the target no longer exists.
type ResolvedMention = {
  chatMessageId: string;
  targetType: "user" | "task" | "doc";
  targetId: string;
  title: string | null;
  projectId: string | null;
  restricted: boolean;
};

type Target = { kind: "channel"; channelId: string } | { kind: "dm"; withUserId: string };

// Consecutive messages from the same sender within this window are
// grouped visually (avatar/name/timestamp shown once for the group)
// instead of each message repeating its own header row.
const GROUP_WINDOW_MS = 60_000;

// Shared between the Dashboard's DM/org-wide-channel feed and a
// project's chat panel (CONTEXT.md §5.1.9/§5.1.10) — same message
// shape, same compose action, only the read/send target differs.
export function ChatThread({
  target,
  projectId,
  profiles,
  header,
  onFocusInput,
}: {
  target: Target;
  projectId?: string;
  profiles: Map<string, UserProfile>;
  // Bar rendered above the scrollable message list, e.g. the DM/channel
  // this thread belongs to. ChatThread only knows the raw target id, not
  // the resolved display name/avatar, so the caller supplies the markup.
  header?: ReactNode;
  // Fired when the compose box gains focus — the signal a caller can
  // use to mark this conversation read (e.g. clear an unread badge):
  // coming back to type a reply means the user has noticed whatever
  // arrived while the thread was already open, which a plain "select
  // this conversation" read-marker wouldn't catch on its own.
  onFocusInput?: () => void;
}) {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // Keyed by chatMessageId — populated by mention.resolve, whose
  // per-viewer permission filtering (§5.1.20) is why this can't ride
  // along in chat.history/conversation's own response or the realtime
  // broadcast payload: the same message can resolve differently for
  // different readers.
  const [mentionResolutions, setMentionResolutions] = useState<Map<string, ResolvedMention[]>>(new Map());
  const bottomRef = useRef<HTMLDivElement>(null);

  const targetKey = target.kind === "channel" ? target.channelId : target.withUserId;
  const conversationContext =
    target.kind === "channel" ? { channelId: target.channelId } : { recipientId: target.withUserId, projectId };

  async function refresh() {
    const rows =
      target.kind === "channel"
        ? await trpc.chat.history.query({ channelId: target.channelId })
        : await trpc.chat.conversation.query({ withUserId: target.withUserId });
    setMessages(rows);

    const candidateIds = rows.filter((r) => mightContainMention(r.content)).map((r) => r.id);
    if (candidateIds.length === 0) {
      setMentionResolutions(new Map());
      return;
    }
    const resolved = await trpc.mention.resolve.query({ messageIds: candidateIds });
    const byMessage = new Map<string, ResolvedMention[]>();
    for (const r of resolved) {
      const existing = byMessage.get(r.chatMessageId);
      if (existing) existing.push(r);
      else byMessage.set(r.chatMessageId, [r]);
    }
    setMentionResolutions(byMessage);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  // Live-append messages pushed via apps/realtime instead of waiting
  // for the next manual refresh (CONTEXT.md §5.1.4's ws+Redis seam —
  // the push is "something changed, go re-fetch/append", scoped here
  // to whichever target this thread instance is showing). Dedupe by
  // id since our own `handleSend()` already appends via its own refresh().
  const meId = session?.user?.id;
  useRealtimeEvent(
    useCallback(
      (event: RealtimeEvent) => {
        if (event.type !== "chat.message") return;
        const message = event.payload.message as IncomingChatMessage;
        const matches =
          target.kind === "channel"
            ? message.channelId === target.channelId
            : message.recipientId !== null &&
              ((message.senderId === meId && message.recipientId === target.withUserId) ||
                (message.senderId === target.withUserId && message.recipientId === meId));
        if (!matches) return;
        setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));

        // Resolution is per-viewer (§5.1.20's read-time permission
        // filtering), so it can't ride along in this broadcast payload —
        // every client resolves for itself after receipt. Chips render
        // as raw tokens for a beat until this lands; expected, not a bug.
        if (mightContainMention(message.content)) {
          void trpc.mention.resolve.query({ messageIds: [message.id] }).then((resolved) => {
            if (resolved.length === 0) return;
            setMentionResolutions((prev) => new Map(prev).set(message.id, resolved));
          });
        }
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [targetKey, meId],
    ),
  );

  function renderMessageContent(message: ChatMessage) {
    const resolutions = mentionResolutions.get(message.id) ?? [];
    return segmentContent(message.content).map((segment, i) => {
      if (segment.kind === "text") return <span key={i}>{segment.text}</span>;
      const { token } = segment;
      const resolution = resolutions.find((r) => r.targetType === token.type && r.targetId === token.id);

      if (token.type === "user") {
        return (
          <span key={i} className="rounded bg-primary/10 px-1 py-0.5 text-primary">
            @{resolution?.title ?? token.id}
          </span>
        );
      }
      if (resolution?.restricted) {
        return (
          <span key={i} className="rounded bg-muted px-1 py-0.5 text-muted-foreground">
            Restricted {token.type}
          </span>
        );
      }
      if (resolution?.title && resolution.projectId) {
        const href =
          token.type === "task"
            ? `/projects/${resolution.projectId}?taskId=${token.id}`
            : `/projects/${resolution.projectId}/docs/${token.id}`;
        return (
          <Link key={i} href={href} className="rounded bg-muted px-1 py-0.5 text-foreground/80 hover:underline">
            #{resolution.title}
          </Link>
        );
      }
      // Not yet resolved (realtime beat before mention.resolve returns),
      // or resolved but the target no longer exists.
      return (
        <span key={i} className="rounded bg-muted px-1 py-0.5 text-muted-foreground">
          #{token.id}
        </span>
      );
    });
  }

  async function handleSend(content: string) {
    if (target.kind === "channel") {
      await trpc.chat.send.mutate({ channelId: target.channelId, content });
    } else {
      await trpc.chat.send.mutate({ recipientId: target.withUserId, content, projectId });
    }
    await refresh();
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {header}
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-1 p-3">
          {messages.map((message, index) => {
            const prev = messages[index - 1];
            const profile = profiles.get(message.senderId);
            const name = profile?.name ?? message.senderId;
            const grouped =
              !!prev &&
              prev.senderId === message.senderId &&
              new Date(message.createdAt).getTime() - new Date(prev.createdAt).getTime() <=
                GROUP_WINDOW_MS;
            const time = new Date(message.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });
            return (
              <div
                key={message.id}
                className={cn(
                  "group flex w-full items-start gap-2.5 rounded-md px-3 py-1.5 hover:bg-muted/40",
                  !grouped && index !== 0 && "mt-2",
                )}
              >
                {grouped ? (
                  <span className="w-8 shrink-0 pt-0.5 text-center text-[10px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                    {time}
                  </span>
                ) : (
                  <Avatar userId={message.senderId} name={name} image={profile?.image} />
                )}
                <div className="min-w-0 flex-1">
                  {!grouped && (
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium">{name}</span>
                      <span className="text-xs text-muted-foreground">{time}</span>
                    </div>
                  )}
                  <p className="text-sm whitespace-pre-wrap">{renderMessageContent(message)}</p>
                </div>
              </div>
            );
          })}
          {messages.length === 0 && (
            <p className="p-2 text-sm text-muted-foreground">No messages yet.</p>
          )}
          <div ref={bottomRef} />
        </div>
      </div>
      <ChatComposer context={conversationContext} onSend={handleSend} onFocus={onFocusInput} />
    </div>
  );
}
