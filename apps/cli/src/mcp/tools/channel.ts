import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { createClient } from "../../client.ts";
import { createChannel, listChannels } from "../../actions/channel.ts";
import { toolResult } from "../toolResult.ts";

type Client = ReturnType<typeof createClient>;

export function registerChannelTools(server: McpServer, client: Client): void {
  server.registerTool(
    "channel_create",
    {
      description: "Create a chat channel — org-wide, or scoped to a project.",
      inputSchema: {
        title: z.string(),
        project: z.string().optional().describe("Project name or id — omit for an org-wide channel"),
      },
    },
    async (args) => toolResult(() => createChannel(client, args)),
  );

  server.registerTool(
    "channel_list",
    {
      description: "List channels, optionally filtered to a project.",
      inputSchema: { project: z.string().optional().describe("Project name or id") },
    },
    async (args) => toolResult(() => listChannels(client, args)),
  );
}
