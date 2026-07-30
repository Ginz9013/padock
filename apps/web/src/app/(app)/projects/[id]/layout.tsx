"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { trpc } from "@/lib/trpc";

type Project = { id: string; name: string };

// Project workspace shell (CONTEXT.md §5's UX shell): Task/Modules/Docs/
// Channels switching now lives in the left AppSidebar's per-project
// sub-nav (Plane's sidebar-tree pattern), so this header is just a
// breadcrumb — no more duplicate top tab bar. Real routes per section,
// not client-side tab state, so e.g. a doc still has its own
// bookmarkable URL.
export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);

  useEffect(() => {
    trpc.project.list.query().then((projects) => {
      setProject(projects.find((p) => p.id === id) ?? null);
    });
  }, [id]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-4 shrink-0">
        <h1 className="font-heading text-2xl font-semibold">{project?.name ?? "Project"}</h1>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
