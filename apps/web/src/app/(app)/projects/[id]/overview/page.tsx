"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { UserMinus } from "lucide-react";

import { trpc } from "@/lib/trpc";
import { useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Project = { id: string; name: string; createdAt: string };
type ProjectRole = "admin" | "member";
type ProjectMember = {
  id: string;
  userId: string;
  role: ProjectRole;
  user: { id: string; name: string; email: string };
};
type OrgUser = { id: string; name: string; email: string };

// The project's "home" — reached by clicking the project name itself in
// the sidebar (not one of the Tasks/Modules/Docs/Channels sub-nav items).
// Basic info plus membership management (ProjectMember, CONTEXT.md's
// access-control model) — the only place in the web UI that surfaces who's
// in a project and lets an admin add/remove/re-role them.
export default function ProjectOverviewPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const [project, setProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      const [projects, memberList, users] = await Promise.all([
        trpc.project.list.query(),
        trpc.project.listMembers.query({ projectId }),
        trpc.user.list.query(),
      ]);
      setProject((projects as Project[]).find((p) => p.id === projectId) ?? null);
      setMembers(memberList as ProjectMember[]);
      setOrgUsers(users as OrgUser[]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load project");
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [projectId]);

  const isAdmin = members.some((m) => m.userId === session?.user?.id && m.role === "admin");
  const memberUserIds = new Set(members.map((m) => m.userId));
  const addableUsers = orgUsers.filter((u) => !memberUserIds.has(u.id));

  async function setRole(userId: string, role: ProjectRole) {
    setError(null);
    try {
      await trpc.project.addMember.mutate({ projectId, userId, role });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update member");
    }
  }

  async function removeMember(userId: string) {
    setError(null);
    try {
      await trpc.project.removeMember.mutate({ projectId, userId });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove member");
    }
  }

  if (!project) {
    return error ? (
      <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {error}
      </p>
    ) : null;
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h2 className="text-sm font-medium text-muted-foreground">Project info</h2>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Name</dt>
          <dd>{project.name}</dd>
          <dt className="text-muted-foreground">Created</dt>
          <dd>{new Date(project.createdAt).toLocaleDateString()}</dd>
          <dt className="text-muted-foreground">Members</dt>
          <dd>{members.length}</dd>
        </dl>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">Members</h2>
          {isAdmin && <AddMemberSearch users={addableUsers} onAdd={(userId) => setRole(userId, "member")} />}
        </div>
        {error && (
          <p className="mb-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </p>
        )}
        {members.length === 0 ? (
          <p className="text-xs text-muted-foreground">No members.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {members.map((m) => {
              const isSelf = m.userId === session?.user?.id;
              return (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm">
                      {m.user.name}
                      {isSelf && <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{m.user.email}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {isAdmin ? (
                      <Select value={m.role} onValueChange={(v) => setRole(m.userId, v as ProjectRole)}>
                        <SelectTrigger size="sm" className="w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="member">Member</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="secondary">{m.role}</Badge>
                    )}
                    {isAdmin && !isSelf && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => removeMember(m.userId)}
                        aria-label="Remove member"
                      >
                        <UserMinus className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

// Dynamic search-filter instead of a dropdown listing every org user —
// picking a result adds them as a `member` immediately (role can be
// promoted to admin afterward via the per-row Select below).
function AddMemberSearch({ users, onAdd }: { users: OrgUser[]; onAdd: (userId: string) => void }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  if (users.length === 0) return null;

  const q = query.trim().toLowerCase();
  const filtered = q
    ? users.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)).slice(0, 8)
    : [];

  return (
    <div className="relative w-56">
      <Input
        placeholder="Add a member…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 100)}
      />
      {open && filtered.length > 0 && (
        <div className="absolute top-full right-0 left-0 z-10 mt-1 overflow-hidden rounded-md border bg-popover shadow-md">
          {filtered.map((u) => (
            <button
              key={u.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onAdd(u.id);
                setQuery("");
                setOpen(false);
              }}
              className="flex w-full flex-col px-3 py-1.5 text-left hover:bg-muted"
            >
              <span className="truncate text-sm">{u.name}</span>
              <span className="truncate text-xs text-muted-foreground">{u.email}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
