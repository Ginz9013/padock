import type { createClient } from "../client.ts";
import { resolveProjectId, resolveTaskStateId } from "../resolve.ts";

type Client = ReturnType<typeof createClient>;

export async function createTask(
  client: Client,
  args: { project: string; title: string; description?: string },
) {
  const projectId = await resolveProjectId(client, args.project);
  return client.task.create.mutate({ projectId, title: args.title, description: args.description });
}

export async function listTasks(client: Client, args: { project: string }) {
  const projectId = await resolveProjectId(client, args.project);
  return client.task.list.query({ projectId });
}

export async function updateTaskStatus(client: Client, args: { id: string; status: string }) {
  const existing = await client.task.get.query({ id: args.id });
  const stateId = await resolveTaskStateId(client, existing.projectId, args.status);
  return client.task.updateState.mutate({ id: args.id, stateId });
}
