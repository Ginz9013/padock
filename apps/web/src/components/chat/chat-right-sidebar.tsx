"use client";

import { useState, type ReactNode } from "react";
import { Clock, Users } from "lucide-react";

import { useChatSidebar, type OrgUser } from "@/components/chat/chat-sidebar-provider";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const RECENT_LIMIT = 10;

// The org-wide chat surface's People list (this session's UX
// decision): lives in a persistent right sidebar across every page —
// mirrors the left AppSidebar's Projects list — so anyone can be
// found and DMed no matter what page you're on, even though the
// actual thread view (ChatThread) only renders on /dashboard. This is
// now the *only* place to pick a DM — Dashboard's own conversation
// list was removed, so people stay listed here permanently instead of
// dropping out once a thread exists (that used to make someone you'd
// just messaged vanish from the list you'd use to message them again).
export function ChatRightSidebar() {
  const { people, selected, isUnread, latestMessageAt, openDm } = useChatSidebar();
  const [query, setQuery] = useState("");

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
      <div className="border-b px-3 py-2">
        <Input
          placeholder="Search people…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-7 text-xs"
        />
      </div>
      <div className="flex-1 overflow-y-auto px-1.5 pb-2">
        {recent.length > 0 && (
          <>
            <SectionLabel icon={<Clock className="size-3.5 text-sidebar-foreground/70" />}>
              Recent
            </SectionLabel>
            {recent.map((user) => (
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

        <SectionLabel icon={<Users className="size-3.5 text-sidebar-foreground/70" />}>
          People
        </SectionLabel>
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
      </div>
    </div>
  );
}

function SectionLabel({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 px-2 pt-3 pb-1 first:pt-2">
      {icon}
      <span className="text-xs font-medium text-sidebar-foreground/70">{children}</span>
    </div>
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
