"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useSession } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc";
import { useChatSidebar } from "@/components/chat/chat-sidebar-provider";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { ChatThread } from "@/components/chat/chat-thread";

type Project = { id: string; name: string };

// Dashboard = the cross-project communication surface (this session's
// UX decision) — project-scoped channels live in their own project's
// chat panel instead (CONTEXT.md §5.1.9/§5.1.10) — plus a compact
// overview of projects, which get their own persistent nav entry in
// the sidebar too.
//
// The People list (and the Conversations list that used to sit next
// to the thread here) both moved to the persistent right sidebar
// (org-wide, every page — @/components/chat/chat-sidebar-provider):
// it's now the *only* place to pick who to talk to. This content area
// is just the thread itself for whoever's selected there.
export default function DashboardPage() {
  const { data: session } = useSession();
  const { selected, profiles, markRead } = useChatSidebar();
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
        <div className="min-h-0 flex-1 overflow-hidden rounded-lg border">
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
              Pick someone from the People sidebar to start a conversation
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
