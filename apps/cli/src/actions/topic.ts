import type { createClient } from "../client.ts";
import { resolveChannelId } from "../resolve.ts";

type Client = ReturnType<typeof createClient>;

export async function createTopic(client: Client, args: { channel: string; title: string }) {
  const channelId = await resolveChannelId(client, args.channel);
  return client.topic.create.mutate({ channelId, title: args.title });
}

export async function listTopics(client: Client, args: { channel: string }) {
  const channelId = await resolveChannelId(client, args.channel);
  return client.topic.list.query({ channelId });
}
