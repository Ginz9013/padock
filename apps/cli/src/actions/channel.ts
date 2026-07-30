import type { createClient } from "../client.ts";
import { resolveProjectId } from "../resolve.ts";

type Client = ReturnType<typeof createClient>;

export async function createChannel(client: Client, args: { title: string; project?: string }) {
  const projectId = args.project ? await resolveProjectId(client, args.project) : undefined;
  return client.channel.create.mutate({ title: args.title, projectId });
}

export async function listChannels(client: Client, args: { project?: string }) {
  const projectId = args.project ? await resolveProjectId(client, args.project) : undefined;
  return client.channel.list.query(projectId ? { projectId } : undefined);
}
