"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

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
  selectConversation: (c: Conversation) => void;
  // Opens (or starts) a DM with this user. Called from the org-wide
  // right sidebar, which — unlike ChatThread — is mounted on every
  // page (this session's UX decision: chat surface is global, the
  // same way the left AppSidebar's Projects list is), so it routes to
  // /dashboard first if the actual thread view isn't already showing.
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
// (ChatThread) stays Dashboard-only, per this session's scope call —
// both need the same conversations/selected/unread state.
export function ChatSidebarProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const profiles = useUserProfiles();
  const { noteLatest, markRead, isUnread } = useUnread();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [people, setPeople] = useState<OrgUser[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);

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
          noteLatest(`channel:${message.channelId}`, message.createdAt);
          return;
        }
        if (!meId || !message.recipientId || message.senderId === meId) return;
        const counterpart = message.senderId;
        const key = `dm:${counterpart}`;
        noteLatest(key, message.createdAt);
        setConversations((prev) =>
          prev.some((c) => c.key === key)
            ? prev
            : [
                { kind: "dm", key, withUserId: counterpart, label: profiles.get(counterpart)?.name ?? counterpart },
                ...prev,
              ],
        );
      },
      [meId, noteLatest, profiles],
    ),
  );

  const selectConversation = useCallback(
    (c: Conversation) => {
      setSelected(c);
      markRead(c.key);
    },
    [markRead],
  );

  const openDm = useCallback(
    (user: OrgUser) => {
      const key = `dm:${user.id}`;
      setConversations((prev) =>
        prev.some((c) => c.key === key)
          ? prev
          : [{ kind: "dm", key, withUserId: user.id, label: user.name }, ...prev],
      );
      setSelected({ kind: "dm", key, withUserId: user.id, label: user.name });
      markRead(key);
      if (pathname !== "/dashboard") router.push("/dashboard");
    },
    [markRead, pathname, router],
  );

  return (
    <ChatSidebarContext.Provider
      value={{ conversations, people, selected, profiles, isUnread, markRead, selectConversation, openDm }}
    >
      {children}
    </ChatSidebarContext.Provider>
  );
}
