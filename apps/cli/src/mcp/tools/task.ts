import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { createClient } from "../../client.ts";
import {
  createTask,
  listTasks,
  updateTaskStatus,
  updateTaskPriority,
  updateTaskDates,
  updateTaskAssignees,
} from "../../actions/task.ts";
import { toolResult } from "../toolResult.ts";

type Client = ReturnType<typeof createClient>;

const priority = z.enum(["urgent", "high", "medium", "low", "none"]);

export function registerTaskTools(server: McpServer, client: Client): void {
  server.registerTool(
    "task_create",
    {
      description: "Create a task in a project. Lands in that project's default task state.",
      inputSchema: {
        project: z.string().describe("Project name or id"),
        title: z.string(),
        description: z.string().optional(),
        priority: priority.optional(),
        startDate: z.string().optional().describe("ISO date"),
        endDate: z.string().optional().describe("ISO date"),
        assignees: z.array(z.string()).optional().describe("Emails/names/ids — must already be project members"),
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

  server.registerTool(
    "task_set_priority",
    {
      description: "Set a task's priority.",
      inputSchema: { id: z.string(), priority },
    },
    async (args) => toolResult(() => updateTaskPriority(client, args)),
  );

  server.registerTool(
    "task_set_dates",
    {
      description: "Set or clear a task's start/end dates. Omit a field to leave it untouched.",
      inputSchema: {
        id: z.string(),
        startDate: z.string().optional().describe("ISO date"),
        endDate: z.string().optional().describe("ISO date"),
        clearStart: z.boolean().optional().describe("Clear the start date instead of setting it"),
        clearEnd: z.boolean().optional().describe("Clear the end date instead of setting it"),
      },
    },
    async (args) => toolResult(() => updateTaskDates(client, args)),
  );

  server.registerTool(
    "task_set_assignees",
    {
      description: "Replace a task's full assignee list. Assignees must already be members of the task's project.",
      inputSchema: {
        id: z.string(),
        assignees: z.array(z.string()).describe("Emails/names/ids"),
      },
    },
    async (args) => toolResult(() => updateTaskAssignees(client, args)),
  );
}
