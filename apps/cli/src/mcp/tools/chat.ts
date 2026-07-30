import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { createClient } from "../../client.ts";
import { sendMessage, getConversation, getChatHistory, getInbox } from "../../actions/chat.ts";
import { toolResult } from "../toolResult.ts";

type Client = ReturnType<typeof createClient>;

export function registerChatTools(server: McpServer, client: Client): void {
  server.registerTool(
    "chat_send",
    {
      description:
        "Send a chat message — either a DM (`to`) or a channel message (`channel`), never both. This is outward-facing: confirm with the user before calling it.",
      inputSchema: {
        to: z.string().optional().describe("DM recipient: email or name"),
        channel: z.string().optional().describe("Channel name or id"),
        message: z.string(),
        project: z.string().optional().describe("DM only: tag the message with a project"),
      },
    },
    async (args) => toolResult(() => sendMessage(client, args)),
  );

  server.registerTool(
    "chat_conversation",
    {
      description: "Read the DM conversation with a specific person.",
      inputSchema: { with: z.string().describe("Email or name") },
    },
    async (args) => toolResult(() => getConversation(client, args)),
  );

  server.registerTool(
    "chat_history",
    {
      description: "Read the message history of a channel.",
      inputSchema: { channel: z.string() },
    },
    async (args) => toolResult(() => getChatHistory(client, args)),
  );

  server.registerTool(
    "chat_inbox",
    { description: "List the most recent DM per person who's messaged you." },
    async () => toolResult(() => getInbox(client)),
  );
}
