"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/lib/auth-client";
import { useRealtimeEvent } from "@/lib/use-realtime";
import type { RealtimeEvent } from "@/lib/realtime";

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

// Shared between the Dashboard's DM/org-wide-channel feed and a
// project's chat panel (CONTEXT.md §5.1.9/§5.1.10) — same message
// shape, same compose action, only the read/send target differs.
export function ChatThread({
  target,
  projectId,
  userNames,
}: {
  target: Target;
  projectId?: string;
  userNames: Map<string, string>;
}) {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

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
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-3 p-3">
          {messages.map((message) => {
            const mine = message.senderId === session?.user?.id;
            return (
              <div key={message.id} className={cn("flex flex-col", mine && "items-end")}>
                <span className="text-xs text-muted-foreground">
                  {userNames.get(message.senderId) ?? message.senderId}
                  {" · "}
                  {new Date(message.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <p
                  className={cn(
                    "mt-0.5 max-w-sm rounded-lg px-3 py-1.5 text-sm",
                    mine ? "bg-primary text-primary-foreground" : "bg-muted",
                  )}
                >
                  {message.content}
                </p>
              </div>
            );
          })}
          {messages.length === 0 && (
            <p className="p-2 text-sm text-muted-foreground">No messages yet.</p>
          )}
          <div ref={bottomRef} />
        </div>
      </div>
      <div className="flex gap-2 border-t p-2">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Write a message…"
          className="min-h-9 flex-1 resize-none"
          rows={1}
        />
        <Button onClick={send} disabled={sending || !draft.trim()}>
          Send
        </Button>
      </div>
    </div>
  );
}
