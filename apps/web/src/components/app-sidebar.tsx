"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Plus } from "lucide-react";

import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Project = { id: string; name: string };

// Persistent global nav (CONTEXT.md §5's UX shell): Dashboard, a
// project list (Plane's "browse all projects" sidebar section is the
// reference — every project is small enough in number for v1 that a
// flat list needs no pinning/search yet), and Approvals.
export function AppSidebar() {
  const pathname = usePathname();
  const [projects, setProjects] = useState<Project[]>([]);

  async function refreshProjects() {
    setProjects(await trpc.project.list.query());
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshProjects();
  }, []);

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r">
      <div className="px-4 py-4">
        <Link href="/dashboard" className="font-heading text-sm font-semibold">
          Padock
        </Link>
      </div>

      <nav className="flex flex-col gap-0.5 px-2">
        <SidebarLink href="/dashboard" active={pathname === "/dashboard"}>
          Dashboard
        </SidebarLink>
      </nav>

      <div className="mt-4 flex items-center justify-between px-4">
        <span className="text-xs font-medium text-muted-foreground">Projects</span>
        <NewProjectDialog onCreated={refreshProjects} />
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-1">
        {projects.map((project) => (
          <SidebarLink
            key={project.id}
            href={`/projects/${project.id}`}
            active={pathname.startsWith(`/projects/${project.id}`)}
          >
            {project.name}
          </SidebarLink>
        ))}
        {projects.length === 0 && (
          <p className="px-2 py-1 text-xs text-muted-foreground">No projects yet.</p>
        )}
      </nav>

      <div className="border-t px-2 py-2">
        <SidebarLink href="/approvals" active={pathname === "/approvals"}>
          Approvals
        </SidebarLink>
      </div>
    </aside>
  );
}

function SidebarLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
        active && "bg-muted font-medium text-foreground",
      )}
    >
      {children}
    </Link>
  );
}

function NewProjectDialog({ onCreated }: { onCreated: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await trpc.project.create.mutate({ name: name.trim() });
      setName("");
      setOpen(false);
      await onCreated();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="text-muted-foreground hover:text-foreground"
          aria-label="New project"
        >
          <Plus className="size-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
        </DialogHeader>
        <Input
          placeholder="Project name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && create()}
          autoFocus
        />
        <DialogFooter>
          <Button onClick={create} disabled={busy || !name.trim()}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
