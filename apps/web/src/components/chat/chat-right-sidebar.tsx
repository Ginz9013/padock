"use client";

import { useState, type ReactNode } from "react";
import { ChevronRight, Clock, Hash, PanelRightClose, Users } from "lucide-react";

import { useChatSidebar, type Conversation, type OrgUser } from "@/components/chat/chat-sidebar-provider";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const RECENT_LIMIT = 10;

// The org-wide chat surface's People list (this session's UX
// decision): lives in a persistent right sidebar across every page —
// mirrors the left AppSidebar's Projects list — so anyone can be
// found and DMed no matter what page you're on, even though the
// actual thread view (ChatThread) only renders on the standalone
// /chat/[userId] and /chat/channel/[channelId] routes. This is now
// the *only* place to pick a DM — Dashboard's own conversation list
// was removed, so people stay listed here permanently instead of
// dropping out once a thread exists (that used to make someone you'd
// just messaged vanish from the list you'd use to message them again).
export function ChatRightSidebar({ onClose }: { onClose?: () => void }) {
  const { people, conversations, selected, isUnread, latestMessageAt, openDm, selectConversation } =
    useChatSidebar();
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState({ recent: false, people: false, channels: false });
  const toggle = (section: keyof typeof collapsed) =>
    setCollapsed((prev) => ({ ...prev, [section]: !prev[section] }));

  const channels = conversations.filter((c) => c.kind === "channel");

  // Most recently messaged first — same recency data the unread dot
  // is built on (dm:<id> → latest known message timestamp, ISO so
  // string comparison sorts correctly), not a separate tracker.
  const recent = people
    .filter((u) => latestMessageAt[`dm:${u.id}`])
    .sort((a, b) => {
      const at = latestMessageAt[`dm:${a.id}`] ?? "";
      const bt = latestMessageAt[`dm:${b.id}`] ?? "";
      return bt.localeCompare(at);
    })
    .slice(0, RECENT_LIMIT);

  const filtered = people.filter((u) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-1.5 border-b px-3 py-2">
        {onClose && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Close chat sidebar"
          >
            <PanelRightClose className="size-4" />
          </Button>
        )}
        <Input
          placeholder="Search people…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-7 flex-1 text-xs"
        />
      </div>
      <div className="flex-1 overflow-y-auto px-1.5 pb-2">
        {recent.length > 0 && (
          <>
            <SectionLabel
              icon={<Clock className="size-3.5 text-sidebar-foreground/70" />}
              collapsed={collapsed.recent}
              onToggle={() => toggle("recent")}
            >
              Recent
            </SectionLabel>
            {!collapsed.recent &&
              recent.map((user) => (
                <PersonRow
                  key={`recent:${user.id}`}
                  user={user}
                  active={selected?.key === `dm:${user.id}`}
                  unread={isUnread(`dm:${user.id}`)}
                  onClick={() => openDm(user)}
                />
              ))}
          </>
        )}

        <SectionLabel
          icon={<Users className="size-3.5 text-sidebar-foreground/70" />}
          collapsed={collapsed.people}
          onToggle={() => toggle("people")}
        >
          People
        </SectionLabel>
        {!collapsed.people && (
          <>
            {filtered.length === 0 && (
              <p className="px-2 py-1.5 text-xs text-sidebar-foreground/60">No people found.</p>
            )}
            {filtered.map((user) => (
              <PersonRow
                key={user.id}
                user={user}
                active={selected?.key === `dm:${user.id}`}
                unread={isUnread(`dm:${user.id}`)}
                onClick={() => openDm(user)}
              />
            ))}
          </>
        )}

        <SectionLabel
          icon={<Hash className="size-3.5 text-sidebar-foreground/70" />}
          collapsed={collapsed.channels}
          onToggle={() => toggle("channels")}
        >
          Channels
        </SectionLabel>
        {!collapsed.channels && (
          <>
            {channels.length === 0 && (
              <p className="px-2 py-1.5 text-xs text-sidebar-foreground/60">No org-wide channels.</p>
            )}
            {channels.map((channel) => (
              <ChannelRow
                key={channel.key}
                channel={channel}
                active={selected?.key === channel.key}
                unread={isUnread(channel.key)}
                onClick={() => selectConversation(channel)}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function SectionLabel({
  icon,
  collapsed,
  onToggle,
  children,
}: {
  icon: ReactNode;
  collapsed: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex w-full items-center gap-1.5 rounded-md px-2 pt-3 pb-1 text-left first:pt-2 hover:bg-sidebar-accent"
      aria-expanded={!collapsed}
    >
      <ChevronRight
        className={cn(
          "size-3 shrink-0 text-sidebar-foreground/50 transition-transform",
          !collapsed && "rotate-90",
        )}
      />
      {icon}
      <span className="text-xs font-medium text-sidebar-foreground/70">{children}</span>
    </button>
  );
}

function PersonRow({
  user,
  active,
  unread,
  onClick,
}: {
  user: OrgUser;
  active: boolean;
  unread: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-sidebar-accent",
        active && "bg-sidebar-accent font-medium",
      )}
    >
      <Avatar userId={user.id} name={user.name} size={7} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm">{user.name}</div>
        <div className="truncate text-xs text-sidebar-foreground/60">{user.email}</div>
      </div>
      {unread && <span className="size-2 shrink-0 rounded-full bg-red-500" aria-label="Unread" />}
    </button>
  );
}

function ChannelRow({
  channel,
  active,
  unread,
  onClick,
}: {
  channel: Conversation;
  active: boolean;
  unread: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-sidebar-accent",
        active && "bg-sidebar-accent font-medium",
      )}
    >
      <Hash className="size-3.5 shrink-0 text-sidebar-foreground/70" />
      <span className="min-w-0 flex-1 truncate text-sm">{channel.label}</span>
      {unread && <span className="size-2 shrink-0 rounded-full bg-red-500" aria-label="Unread" />}
    </button>
  );
}
