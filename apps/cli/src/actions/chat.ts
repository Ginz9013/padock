import type { createClient } from "../client.ts";
import { resolveProjectId, resolveUserId, resolveChannelId, resolveTopicId } from "../resolve.ts";

type Client = ReturnType<typeof createClient>;

// `to` or (`channel` + `topic`) — never both, matching the DM-vs-
// channel split in the tRPC router's own union input. Throws (not
// process.exit) on the invalid case, since this is shared with the
// long-running MCP server, not just a one-shot CLI invocation.
export async function sendMessage(
  client: Client,
  args: { to?: string; channel?: string; topic?: string; message: string; project?: string },
) {
  if (args.to) {
    const recipientId = await resolveUserId(client, args.to);
    const projectId = args.project ? await resolveProjectId(client, args.project) : undefined;
    return client.chat.send.mutate({ recipientId, content: args.message, projectId });
  }
  if (args.channel && args.topic) {
    const channelId = await resolveChannelId(client, args.channel);
    const topicId = await resolveTopicId(client, channelId, args.topic);
    return client.chat.send.mutate({ channelId, topicId, content: args.message });
  }
  throw new Error("Provide either `to`, or both `channel` and `topic`");
}

export async function getConversation(client: Client, args: { with: string }) {
  const withUserId = await resolveUserId(client, args.with);
  return client.chat.conversation.query({ withUserId });
}

export async function getChatHistory(client: Client, args: { channel: string; topic: string }) {
  const channelId = await resolveChannelId(client, args.channel);
  const topicId = await resolveTopicId(client, channelId, args.topic);
  return client.chat.history.query({ channelId, topicId });
}

export async function getInbox(client: Client) {
  return client.chat.inbox.query();
}
