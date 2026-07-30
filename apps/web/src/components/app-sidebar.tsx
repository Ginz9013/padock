"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { PanelLeftClose, Pin, PinOff, Plus } from "lucide-react";

import { trpc } from "@/lib/trpc";
import { usePinnedProjects } from "@/lib/use-pinned-projects";
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

// Persistent project nav (CONTEXT.md §5's UX shell): a project list
// and Approvals. Shaped after ChatRightSidebar (this session's UX
// decision): resizable-by-drag and collapsible via a toggle button in
// its own top bar rather than the app header, with projects a user
// pins staying fixed in a "Pinned" section above the full list
// instead of a recency-based "Recent" section — there's no
// message-timestamp signal to sort projects by the way DMs have. The
// "Padock" brand link lives in the app header instead (this session's
// UX decision) since the sidebar is project-scoped, not a brand home.
export function AppSidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const [projects, setProjects] = useState<Project[]>([]);
  const { isPinned, togglePin } = usePinnedProjects();

  async function refreshProjects() {
    setProjects(await trpc.project.list.query());
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshProjects();
  }, []);

  // Pinned projects are surfaced once, up top — the full list below
  // excludes them so nothing is listed twice (same rule ChatRightSidebar
  // uses to keep "Recent" and "People" from double-listing someone).
  const pinned = projects.filter((p) => isPinned(p.id));
  const rest = projects.filter((p) => !isPinned(p.id));

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center justify-end border-b px-3 py-2">
        {onClose && (
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Collapse sidebar">
            <PanelLeftClose className="size-4" />
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-1.5 pb-2">
        {pinned.length > 0 && (
          <>
            <SectionLabel>Pinned</SectionLabel>
            {pinned.map((project) => (
              <ProjectRow
                key={project.id}
                project={project}
                active={pathname.startsWith(`/projects/${project.id}`)}
                pinned
                onTogglePin={() => togglePin(project.id)}
              />
            ))}
          </>
        )}

        <div className="mt-3 flex items-center justify-between px-2 first:mt-2">
          <span className="text-xs font-medium text-sidebar-foreground/70">Projects</span>
          <NewProjectDialog onCreated={refreshProjects} />
        </div>
        {rest.map((project) => (
          <ProjectRow
            key={project.id}
            project={project}
            active={pathname.startsWith(`/projects/${project.id}`)}
            pinned={false}
            onTogglePin={() => togglePin(project.id)}
          />
        ))}
        {projects.length === 0 && (
          <p className="px-2 py-1.5 text-xs text-sidebar-foreground/60">No projects yet.</p>
        )}
      </div>

      <div className="border-t px-2 py-2">
        <SidebarLink href="/approvals" active={pathname === "/approvals"}>
          Approvals
        </SidebarLink>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-2 pt-3 pb-1 text-xs font-medium text-sidebar-foreground/70 first:pt-2">
      {children}
    </div>
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
        "rounded-md px-2 py-1.5 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
        active && "bg-sidebar-accent font-medium text-sidebar-foreground",
      )}
    >
      {children}
    </Link>
  );
}

function ProjectRow({
  project,
  active,
  pinned,
  onTogglePin,
}: {
  project: Project;
  active: boolean;
  pinned: boolean;
  onTogglePin: () => void;
}) {
  return (
    <div
      className={cn(
        "group flex items-center rounded-md hover:bg-sidebar-accent",
        active && "bg-sidebar-accent",
      )}
    >
      <Link
        href={`/projects/${project.id}`}
        className={cn(
          "min-w-0 flex-1 truncate px-2 py-1.5 text-sm text-sidebar-foreground/70",
          active && "font-medium text-sidebar-foreground",
        )}
      >
        {project.name}
      </Link>
      <button
        onClick={onTogglePin}
        className={cn(
          "mr-1.5 shrink-0 text-sidebar-foreground/50 opacity-0 hover:text-sidebar-foreground group-hover:opacity-100",
          pinned && "opacity-100",
        )}
        aria-label={pinned ? "Unpin project" : "Pin project"}
      >
        {pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
      </button>
    </div>
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
          className="text-sidebar-foreground/70 hover:text-sidebar-foreground"
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
