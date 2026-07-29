import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { createClient } from "../../client.ts";
import { createTaskState, listTaskStates } from "../../actions/taskState.ts";
import { toolResult } from "../toolResult.ts";

type Client = ReturnType<typeof createClient>;

const groupEnum = z.enum(["backlog", "unstarted", "started", "completed", "cancelled"]);

export function registerTaskStateTools(server: McpServer, client: Client): void {
  server.registerTool(
    "task_state_create",
    {
      description: "Define a custom task state (workflow status) for a project.",
      inputSchema: {
        project: z.string().describe("Project name or id"),
        name: z.string(),
        group: groupEnum,
        isDefault: z.boolean().optional().describe("Make this the state new tasks land in"),
      },
    },
    async (args) => toolResult(() => createTaskState(client, args)),
  );

  server.registerTool(
    "task_state_list",
    {
      description: "List a project's task states (its configured workflow).",
      inputSchema: { project: z.string().describe("Project name or id") },
    },
    async (args) => toolResult(() => listTaskStates(client, args)),
  );
}
