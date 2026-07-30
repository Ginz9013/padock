"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Hash, MessageCircle } from "lucide-react";

import { useSession } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc";
import { useChatSidebar } from "@/components/chat/chat-sidebar-provider";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { ChatThread } from "@/components/chat/chat-thread";

type Project = { id: string; name: string };

// Dashboard = the cross-project communication surface (this session's
// UX decision): a merged feed of DMs + org-wide channels — project-
// scoped channels live in their own project's chat panel instead
// (CONTEXT.md §5.1.9/§5.1.10) — plus a compact overview of projects,
// which get their own persistent nav entry in the sidebar too.
//
// The People list used to live here too; it's now the persistent
// right sidebar (org-wide, every page — @/components/chat/chat-
// sidebar-provider) since finding someone to DM shouldn't require
// being on this specific page. This content area keeps only what's
// Dashboard-specific: the Conversations list and the actual thread.
export default function DashboardPage() {
  const { data: session } = useSession();
  const { conversations, selected, profiles, isUnread, markRead, selectConversation } =
    useChatSidebar();
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    if (session?.user) void trpc.project.list.query().then(setProjects);
  }, [session?.user?.id]);

  return (
    <div className="flex h-full flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">
          {session?.user ? `Welcome, ${session.user.name}` : "Dashboard"}
        </h1>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">Projects</h2>
        {projects.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No projects yet — create one from the sidebar.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {projects.map((project) => (
              <Link key={project.id} href={`/projects/${project.id}`}>
                <Card size="sm" className="transition-colors hover:bg-muted/50">
                  <CardHeader>
                    <CardTitle>{project.name}</CardTitle>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="flex min-h-0 flex-1 flex-col">
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">Messages</h2>
        <div className="flex min-h-0 flex-1 overflow-hidden rounded-lg border">
          <div className="flex w-56 shrink-0 flex-col overflow-y-auto border-r">
            {conversations.length === 0 && (
              <p className="p-3 text-sm text-muted-foreground">Nothing here yet.</p>
            )}
            {conversations.map((c) => (
              <button
                key={c.key}
                onClick={() => selectConversation(c)}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted",
                  selected?.key === c.key && "bg-muted font-medium",
                )}
              >
                {c.kind === "dm" ? (
                  <MessageCircle className="size-3.5 shrink-0 text-muted-foreground" />
                ) : (
                  <Hash className="size-3.5 shrink-0 text-muted-foreground" />
                )}
                <span className="min-w-0 flex-1 truncate">{c.label}</span>
                {isUnread(c.key) && (
                  <span className="size-2 shrink-0 rounded-full bg-red-500" aria-label="Unread" />
                )}
              </button>
            ))}
          </div>
          <div className="min-w-0 flex-1">
            {selected ? (
              <ChatThread
                target={
                  selected.kind === "dm"
                    ? { kind: "dm", withUserId: selected.withUserId }
                    : { kind: "channel", channelId: selected.channelId }
                }
                profiles={profiles}
                onFocusInput={() => markRead(selected.key)}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Select a conversation
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
