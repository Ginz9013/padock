"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useSession } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

type Project = { id: string; name: string };

// Dashboard is a pure overview page (this session's UX decision): the
// chat thread that used to live here moved to its own standalone
// /chat/[userId] and /chat/channel/[channelId] routes, so this page
// is just the projects overview now — the People list still lives in
// the persistent right sidebar (@/components/chat/chat-sidebar-provider)
// on every page, but picking someone navigates to /chat instead of
// rendering a thread inline here.
export default function DashboardPage() {
  const { data: session } = useSession();
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
    </div>
  );
}
