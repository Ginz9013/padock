import type { createClient } from "../client.ts";
import { resolveProjectId } from "../resolve.ts";

type Client = ReturnType<typeof createClient>;

export async function createTaskState(
  client: Client,
  args: {
    project: string;
    name: string;
    group: "backlog" | "unstarted" | "started" | "completed" | "cancelled";
    isDefault?: boolean;
  },
) {
  const projectId = await resolveProjectId(client, args.project);
  return client.taskState.create.mutate({
    projectId,
    name: args.name,
    group: args.group,
    isDefault: args.isDefault,
  });
}

export async function listTaskStates(client: Client, args: { project: string }) {
  const projectId = await resolveProjectId(client, args.project);
  return client.taskState.list.query({ projectId });
}
