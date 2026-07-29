import type { createClient } from "../client.ts";

type Client = ReturnType<typeof createClient>;

// Shared by both the CLI commands (commands/project.ts) and the MCP
// tools (mcp/tools/project.ts) — one implementation, two thin
// callers. See CONTEXT.md §5.3/Phase 5.
export async function createProject(client: Client, args: { name: string }) {
  return client.project.create.mutate({ name: args.name });
}

export async function listProjects(client: Client) {
  return client.project.list.query();
}
