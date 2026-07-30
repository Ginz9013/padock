"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { ChannelPanel } from "@/components/chat/channel-panel";

type Project = { id: string; name: string };

// Project workspace shell (CONTEXT.md §5's UX shell): Task is the
// default/main view, Docs is a sibling tab (Plane Navigation 2.0's
// horizontal-tab pattern, §5.1.11) — real routes, not client-side tab
// state, so a doc has its own bookmarkable URL. The chat panel is
// orthogonal to both, not a third tab (§5.1.10).
export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const pathname = usePathname();
  const [project, setProject] = useState<Project | null>(null);

  useEffect(() => {
    trpc.project.list.query().then((projects) => {
      setProject(projects.find((p) => p.id === id) ?? null);
    });
  }, [id]);

  const docsActive = pathname.startsWith(`/projects/${id}/docs`);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-4 shrink-0">
        <h1 className="font-heading text-2xl font-semibold">{project?.name ?? "Project"}</h1>
        <nav className="mt-3 flex gap-1 border-b">
          <ProjectTab href={`/projects/${id}`} active={!docsActive}>
            Task
          </ProjectTab>
          <ProjectTab href={`/projects/${id}/docs`} active={docsActive}>
            Docs
          </ProjectTab>
        </nav>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-y-auto pr-4">{children}</div>
        <ChannelPanel projectId={id} />
      </div>
    </div>
  );
}

function ProjectTab({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "-mb-px border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground hover:text-foreground",
        active && "border-foreground font-medium text-foreground",
      )}
    >
      {children}
    </Link>
  );
}
