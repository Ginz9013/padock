import type { createClient } from "../client.ts";
import { resolveProjectId, resolveUserId } from "../resolve.ts";

type Client = ReturnType<typeof createClient>;

// Shared by both the CLI commands (commands/project.ts) and the MCP
// tools (mcp/tools/project.ts) — one implementation, two thin
// callers. See CONTEXT.md §5.3/Phase 5.
export async function createProject(client: Client, args: { name: string }) {
  return client.project.create.mutate({ name: args.name });
}

// Only returns projects the caller is a member of — not every project in
// the org anymore (project-level access control, see CONTEXT.md).
export async function listProjects(client: Client) {
  return client.project.list.query();
}

export async function listProjectMembers(client: Client, args: { project: string }) {
  const projectId = await resolveProjectId(client, args.project);
  return client.project.listMembers.query({ projectId });
}

export async function addProjectMember(client: Client, args: { project: string; user: string; role?: string }) {
  const projectId = await resolveProjectId(client, args.project);
  const userId = await resolveUserId(client, args.user);
  const role = args.role === "admin" ? "admin" : "member";
  return client.project.addMember.mutate({ projectId, userId, role });
}

export async function removeProjectMember(client: Client, args: { project: string; user: string }) {
  const projectId = await resolveProjectId(client, args.project);
  const userId = await resolveUserId(client, args.user);
  return client.project.removeMember.mutate({ projectId, userId });
}
