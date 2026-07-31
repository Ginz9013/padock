import type { createClient } from "./client.ts";

type Client = ReturnType<typeof createClient>;

// §5.2's own grammar uses `--project=<name>` — nobody should need a
// Prisma cuid to run a command. Match by name first, fall back to
// treating the input as a literal id (so scripts that already have an
// id keep working).
export async function resolveProjectId(client: Client, nameOrId: string): Promise<string> {
  const projects = await client.project.list.query();
  const match = projects.find((p) => p.name.toLowerCase() === nameOrId.toLowerCase());
  return match ? match.id : nameOrId;
}

export async function resolveUserId(client: Client, value: string): Promise<string> {
  const users = await client.user.list.query();
  const match = users.find(
    (u) => u.email.toLowerCase() === value.toLowerCase() || u.name.toLowerCase() === value.toLowerCase(),
  );
  return match ? match.id : value;
}

// `projectId` scopes the lookup to one project's channels — required to
// resolve a project-scoped channel by name, since the server now only
// returns org-wide channels when no project is given (a non-member can't
// discover another project's channel titles that way).
export async function resolveChannelId(client: Client, nameOrId: string, projectId?: string): Promise<string> {
  const channels = await client.channel.list.query(projectId ? { projectId } : undefined);
  const match = channels.find((c) => c.title.toLowerCase() === nameOrId.toLowerCase());
  return match ? match.id : nameOrId;
}

export async function resolveTaskStateId(client: Client, projectId: string, nameOrId: string): Promise<string> {
  const states = await client.taskState.list.query({ projectId });
  const match = states.find((s) => s.name.toLowerCase() === nameOrId.toLowerCase());
  return match ? match.id : nameOrId;
}

export async function resolveLabelId(client: Client, projectId: string, nameOrId: string): Promise<string> {
  const labels = await client.label.list.query({ projectId });
  const match = labels.find((l) => l.name.toLowerCase() === nameOrId.toLowerCase());
  return match ? match.id : nameOrId;
}
