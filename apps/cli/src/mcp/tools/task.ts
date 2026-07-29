import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { createClient } from "../../client.ts";
import { createTask, listTasks, updateTaskStatus } from "../../actions/task.ts";
import { toolResult } from "../toolResult.ts";

type Client = ReturnType<typeof createClient>;

export function registerTaskTools(server: McpServer, client: Client): void {
  server.registerTool(
    "task_create",
    {
      description: "Create a task in a project. Lands in that project's default task state.",
      inputSchema: {
        project: z.string().describe("Project name or id"),
        title: z.string(),
        description: z.string().optional(),
      },
    },
    async (args) => toolResult(() => createTask(client, args)),
  );

  server.registerTool(
    "task_list",
    {
      description: "List tasks in a project.",
      inputSchema: { project: z.string().describe("Project name or id") },
    },
    async (args) => toolResult(() => listTasks(client, args)),
  );

  server.registerTool(
    "task_update",
    {
      description:
        "Change a task's status. `status` is a task-state name in that task's own project (see task_state_list) — not a fixed enum.",
      inputSchema: { id: z.string(), status: z.string() },
    },
    async (args) => toolResult(() => updateTaskStatus(client, args)),
  );
}
