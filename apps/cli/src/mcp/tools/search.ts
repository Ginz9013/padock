import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { createClient } from "../../client.ts";
import { search } from "../../actions/search.ts";
import { toolResult } from "../toolResult.ts";

type Client = ReturnType<typeof createClient>;

export function registerSearchTools(server: McpServer, client: Client): void {
  server.registerTool(
    "search",
    {
      description:
        "Full-text search across docs, tasks, and chat (keyword search, not semantic). Filter by scope and/or project.",
      inputSchema: {
        query: z.string(),
        scope: z.array(z.enum(["docs", "tasks", "chat"])).optional(),
        project: z.string().optional().describe("Project name or id"),
      },
    },
    async (args) => toolResult(() => search(client, args)),
  );
}
