import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { createClient } from "../../client.ts";
import { createTopic, listTopics } from "../../actions/topic.ts";
import { toolResult } from "../toolResult.ts";

type Client = ReturnType<typeof createClient>;

export function registerTopicTools(server: McpServer, client: Client): void {
  server.registerTool(
    "topic_create",
    {
      description: "Create a topic (thread) within a channel.",
      inputSchema: { channel: z.string().describe("Channel name or id"), title: z.string() },
    },
    async (args) => toolResult(() => createTopic(client, args)),
  );

  server.registerTool(
    "topic_list",
    {
      description: "List topics in a channel.",
      inputSchema: { channel: z.string().describe("Channel name or id") },
    },
    async (args) => toolResult(() => listTopics(client, args)),
  );
}
