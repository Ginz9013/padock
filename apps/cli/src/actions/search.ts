import type { createClient } from "../client.ts";
import { resolveProjectId } from "../resolve.ts";

type Client = ReturnType<typeof createClient>;

export async function search(
  client: Client,
  args: { query: string; scope?: ("docs" | "tasks" | "chat")[]; project?: string },
) {
  const projectId = args.project ? await resolveProjectId(client, args.project) : undefined;
  return client.search.search.query({ query: args.query, scope: args.scope, projectId });
}
