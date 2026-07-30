"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";

import { useSession } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc";
import { useUserProfiles, type UserProfile } from "@/lib/use-user-profiles";
import { useRealtimeEvent } from "@/lib/use-realtime";
import type { RealtimeEvent } from "@/lib/realtime";
import { useUnread } from "@/lib/use-unread";

type Channel = { id: string; title: string; projectId: string | null };
type Inbox = { senderId: string; recipientId: string | null; createdAt: string }[];
export type OrgUser = { id: string; name: string; email: string };
type IncomingChatMessage = {
  senderId: string;
  recipientId: string | null;
  channelId: string | null;
  createdAt: string;
};

export type Conversation =
  | { kind: "dm"; key: string; withUserId: string; label: string }
  | { kind: "channel"; key: string; channelId: string; label: string };

type ChatSidebarValue = {
  conversations: Conversation[];
  people: OrgUser[];
  selected: Conversation | null;
  profiles: Map<string, UserProfile>;
  isUnread: (key: string) => boolean;
  markRead: (key: string) => void;
  // Latest known message timestamp (ISO string) per conversation key —
  // the same recency data `isUnread` is built on, exposed so the
  // sidebar's Recent section can sort people by it directly.
  latestMessageAt: Record<string, string>;
  selectConversation: (c: Conversation) => void;
  // Opens (or starts) a DM with this user. Called from the org-wide
  // right sidebar, which — unlike ChatThread — is mounted on every
  // page (this session's UX decision: chat surface is global, the
  // same way the left AppSidebar's Projects list is), so it routes to
  // this user's own /chat/[userId] route.
  openDm: (user: OrgUser) => void;
};

const ChatSidebarContext = createContext<ChatSidebarValue | null>(null);

export function useChatSidebar(): ChatSidebarValue {
  const ctx = useContext(ChatSidebarContext);
  if (!ctx) throw new Error("useChatSidebar must be used within ChatSidebarProvider");
  return ctx;
}

// Lifted out of the Dashboard page (CONTEXT.md §5.1.9/§5.1.10's chat
// feed) so the org-wide People list can live in a persistent right
// sidebar across every page while the actual DM/channel thread view
// (ChatThread) lives on its own /chat/[userId] and
// /chat/channel/[channelId] routes (this session's UX decision — chat
// is a standalone screen now, not squeezed into Dashboard) — both
// need the same conversations/selected/unread state.
export function ChatSidebarProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ userId?: string; channelId?: string }>();
  const profiles = useUserProfiles();
  const { noteLatest, markRead, isUnread, latest } = useUnread();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [people, setPeople] = useState<OrgUser[]>([]);

  useEffect(() => {
    async function load() {
      const [channels, inbox, users] = await Promise.all([
        trpc.channel.list.query() as Promise<Channel[]>,
        trpc.chat.inbox.query() as Promise<Inbox>,
        trpc.user.list.query() as Promise<OrgUser[]>,
      ]);

      const meId = session?.user?.id;
      const dms: Conversation[] = inbox.map((m) => {
        const withUserId = m.senderId === meId ? m.recipientId! : m.senderId;
        noteLatest(`dm:${withUserId}`, m.createdAt);
        return {
          kind: "dm",
          key: `dm:${withUserId}`,
          withUserId,
          label: profiles.get(withUserId)?.name ?? withUserId,
        };
      });
      const orgWideChannels: Conversation[] = channels
        .filter((c) => c.projectId === null)
        .map((c) => ({ kind: "channel", key: `channel:${c.id}`, channelId: c.id, label: c.title }));

      setConversations([...dms, ...orgWideChannels]);
      setPeople(users.filter((u) => u.id !== meId));
    }
    if (session?.user) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, profiles.size]);

  const meId = session?.user?.id;
  useRealtimeEvent(
    useCallback(
      (event: RealtimeEvent) => {
        if (event.type !== "chat.message") return;
        const message = event.message as IncomingChatMessage;

        if (message.channelId) {
          const key = `channel:${message.channelId}`;
          // Noted regardless of direction — the Recent list needs to
          // reflect a channel message you just *sent*, not only ones
          // you received. But if you're the sender, immediately mark
          // it read too, so posting your own message doesn't light up
          // its own unread badge.
          noteLatest(key, message.createdAt);
          if (message.senderId === meId) markRead(key);
          return;
        }
        if (!meId || !message.recipientId) return;
        const counterpart = message.senderId === meId ? message.recipientId : message.senderId;
        const key = `dm:${counterpart}`;
        // Noted regardless of direction — the Recent list needs to
        // reflect a DM you just *sent*, not only ones you received.
        noteLatest(key, message.createdAt);
        if (message.senderId === meId) {
          // Sending your own message shouldn't flag the conversation
          // unread for yourself.
          markRead(key);
        } else {
          setConversations((prev) =>
            prev.some((c) => c.key === key)
              ? prev
              : [
                  { kind: "dm", key, withUserId: counterpart, label: profiles.get(counterpart)?.name ?? counterpart },
                  ...prev,
                ],
          );
        }
      },
      [meId, noteLatest, markRead, profiles],
    ),
  );

  // Selected conversation is derived from the URL rather than kept as
  // its own state: the thread view is now whatever /chat/[userId] or
  // /chat/channel/[channelId] the user is actually on, so a direct
  // link, a refresh, or browser back/forward all land on the right
  // thread with nothing extra to keep in sync.
  const channelIdInUrl = pathname.startsWith("/chat/channel/") ? params.channelId : undefined;
  const userIdInUrl =
    pathname.startsWith("/chat/") && !pathname.startsWith("/chat/channel/") ? params.userId : undefined;

  const selected: Conversation | null = channelIdInUrl
    ? (conversations.find((c) => c.key === `channel:${channelIdInUrl}`) ?? {
        kind: "channel",
        key: `channel:${channelIdInUrl}`,
        channelId: channelIdInUrl,
        label: channelIdInUrl,
      })
    : userIdInUrl
      ? (conversations.find((c) => c.key === `dm:${userIdInUrl}`) ?? {
          kind: "dm",
          key: `dm:${userIdInUrl}`,
          withUserId: userIdInUrl,
          label: profiles.get(userIdInUrl)?.name ?? userIdInUrl,
        })
      : null;

  useEffect(() => {
    if (selected) markRead(selected.key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.key]);

  const selectConversation = useCallback(
    (c: Conversation) => {
      router.push(c.kind === "dm" ? `/chat/${c.withUserId}` : `/chat/channel/${c.channelId}`);
    },
    [router],
  );

  const openDm = useCallback(
    (user: OrgUser) => {
      const key = `dm:${user.id}`;
      setConversations((prev) =>
        prev.some((c) => c.key === key)
          ? prev
          : [{ kind: "dm", key, withUserId: user.id, label: user.name }, ...prev],
      );
      router.push(`/chat/${user.id}`);
    },
    [router],
  );

  return (
    <ChatSidebarContext.Provider
      value={{
        conversations,
        people,
        selected,
        profiles,
        isUnread,
        markRead,
        latestMessageAt: latest,
        selectConversation,
        openDm,
      }}
    >
      {children}
    </ChatSidebarContext.Provider>
  );
}
