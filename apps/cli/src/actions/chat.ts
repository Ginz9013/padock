import type { createClient } from "../client.ts";
import { resolveProjectId, resolveUserId, resolveChannelId } from "../resolve.ts";

type Client = ReturnType<typeof createClient>;

// `to` or `channel` — never both, matching the DM-vs-channel split in
// the tRPC router's own union input. Throws (not process.exit) on the
// invalid case, since this is shared with the long-running MCP
// server, not just a one-shot CLI invocation.
export async function sendMessage(
  client: Client,
  args: { to?: string; channel?: string; message: string; project?: string },
) {
  if (args.to) {
    const recipientId = await resolveUserId(client, args.to);
    const projectId = args.project ? await resolveProjectId(client, args.project) : undefined;
    return client.chat.send.mutate({ recipientId, content: args.message, projectId });
  }
  if (args.channel) {
    const channelId = await resolveChannelId(client, args.channel);
    return client.chat.send.mutate({ channelId, content: args.message });
  }
  throw new Error("Provide either `to` or `channel`");
}

export async function getConversation(client: Client, args: { with: string }) {
  const withUserId = await resolveUserId(client, args.with);
  return client.chat.conversation.query({ withUserId });
}

export async function getChatHistory(client: Client, args: { channel: string }) {
  const channelId = await resolveChannelId(client, args.channel);
  return client.chat.history.query({ channelId });
}

export async function getInbox(client: Client) {
  return client.chat.inbox.query();
}
