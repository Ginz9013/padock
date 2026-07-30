"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar } from "@/components/ui/avatar";
import { useSession } from "@/lib/auth-client";
import { useRealtimeEvent } from "@/lib/use-realtime";
import type { RealtimeEvent } from "@/lib/realtime";
import type { UserProfile } from "@/lib/use-user-profiles";

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
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  // Defaults to the Windows/Linux label for a stable SSR render, then
  // flips to the Mac symbol post-mount once `navigator` is available.
  const [sendShortcutLabel, setSendShortcutLabel] = useState("Ctrl");
  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.platform)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSendShortcutLabel("⌘");
    }
  }, []);

  const targetKey = target.kind === "channel" ? target.channelId : target.withUserId;

  async function refresh() {
    const rows =
      target.kind === "channel"
        ? await trpc.chat.history.query({ channelId: target.channelId })
        : await trpc.chat.conversation.query({ withUserId: target.withUserId });
    setMessages(rows);
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
  // id since our own `send()` already appends via its own refresh().
  const meId = session?.user?.id;
  useRealtimeEvent(
    useCallback(
      (event: RealtimeEvent) => {
        if (event.type !== "chat.message") return;
        const message = event.message as IncomingChatMessage;
        const matches =
          target.kind === "channel"
            ? message.channelId === target.channelId
            : message.recipientId !== null &&
              ((message.senderId === meId && message.recipientId === target.withUserId) ||
                (message.senderId === target.withUserId && message.recipientId === meId));
        if (!matches) return;
        setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [targetKey, meId],
    ),
  );

  async function send() {
    const content = draft.trim();
    if (!content) return;
    setSending(true);
    try {
      if (target.kind === "channel") {
        await trpc.chat.send.mutate({ channelId: target.channelId, content });
      } else {
        await trpc.chat.send.mutate({ recipientId: target.withUserId, content, projectId });
      }
      setDraft("");
      await refresh();
    } finally {
      setSending(false);
    }
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
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
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
      <div className="flex items-end gap-2 border-t px-3 pt-3 pb-2">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Ctrl+Enter on Windows/Linux, Cmd+Enter on Mac.
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              send();
            }
          }}
          onFocus={onFocusInput}
          placeholder={`Write a message… (${sendShortcutLabel}+Enter to send)`}
          className="min-h-9 flex-1 resize-none rounded-lg border-none bg-muted px-2.5 py-2 shadow-none focus-visible:ring-0"
          rows={1}
        />
        <Button onClick={send} disabled={sending || !draft.trim()}>
          Send
        </Button>
      </div>
    </div>
  );
}
