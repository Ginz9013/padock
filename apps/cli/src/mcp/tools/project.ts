import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { createClient } from "../../client.ts";
import { createProject, listProjects } from "../../actions/project.ts";
import { toolResult } from "../toolResult.ts";

type Client = ReturnType<typeof createClient>;

export function registerProjectTools(server: McpServer, client: Client): void {
  server.registerTool(
    "project_create",
    {
      description: "Create a new Padock project.",
      inputSchema: { name: z.string().describe("Project name") },
    },
    async (args) => toolResult(() => createProject(client, args)),
  );

  server.registerTool(
    "project_list",
    { description: "List all Padock projects." },
    async () => toolResult(() => listProjects(client)),
  );
}
