import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { createClient } from "../../client.ts";
import { createLabel, listLabels, deleteLabel } from "../../actions/label.ts";
import { toolResult } from "../toolResult.ts";

type Client = ReturnType<typeof createClient>;

export function registerLabelTools(server: McpServer, client: Client): void {
  server.registerTool(
    "label_create",
    {
      description: "Define a tag/label for a project.",
      inputSchema: {
        project: z.string().describe("Project name or id"),
        name: z.string(),
        color: z.string().describe("Hex color, e.g. #f97316"),
      },
    },
    async (args) => toolResult(() => createLabel(client, args)),
  );

  server.registerTool(
    "label_list",
    {
      description: "List a project's labels.",
      inputSchema: { project: z.string().describe("Project name or id") },
    },
    async (args) => toolResult(() => listLabels(client, args)),
  );

  server.registerTool(
    "label_delete",
    {
      description: "Delete a project's label.",
      inputSchema: { project: z.string().describe("Project name or id"), label: z.string().describe("Label name or id") },
    },
    async (args) => toolResult(() => deleteLabel(client, args)),
  );
}
