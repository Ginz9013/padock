"use client";

import { useState } from "react";
import { Users } from "lucide-react";

import { useChatSidebar } from "@/components/chat/chat-sidebar-provider";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

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
  const { people, selected, isUnread, openDm } = useChatSidebar();
  const [query, setQuery] = useState("");

  const filtered = people.filter((u) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-1.5 border-b px-3 py-3">
        <Users className="size-3.5 text-sidebar-foreground/70" />
        <span className="text-xs font-medium text-sidebar-foreground/70">People</span>
      </div>
      <div className="px-3 py-2">
        <Input
          placeholder="Search people…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-7 text-xs"
        />
      </div>
      <div className="flex-1 overflow-y-auto px-1.5 pb-2">
        {filtered.length === 0 && (
          <p className="px-2 py-1.5 text-xs text-sidebar-foreground/60">No people found.</p>
        )}
        {filtered.map((user) => {
          const key = `dm:${user.id}`;
          const active = selected?.key === key;
          return (
            <button
              key={user.id}
              onClick={() => openDm(user)}
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
              {isUnread(key) && (
                <span className="size-2 shrink-0 rounded-full bg-red-500" aria-label="Unread" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
