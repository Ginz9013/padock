import type { createClient } from "../client.ts";
import { resolveProjectId, resolveLabelId } from "../resolve.ts";

type Client = ReturnType<typeof createClient>;

export async function createLabel(client: Client, args: { project: string; name: string; color: string }) {
  const projectId = await resolveProjectId(client, args.project);
  return client.label.create.mutate({ projectId, name: args.name, color: args.color });
}

export async function listLabels(client: Client, args: { project: string }) {
  const projectId = await resolveProjectId(client, args.project);
  return client.label.list.query({ projectId });
}

export async function deleteLabel(client: Client, args: { project: string; label: string }) {
  const projectId = await resolveProjectId(client, args.project);
  const id = await resolveLabelId(client, projectId, args.label);
  return client.label.delete.mutate({ id });
}
