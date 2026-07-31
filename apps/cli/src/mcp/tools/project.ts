import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { createClient } from "../../client.ts";
import {
  createProject,
  listProjects,
  listProjectMembers,
  addProjectMember,
  removeProjectMember,
} from "../../actions/project.ts";
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
    { description: "List the Padock projects you're a member of." },
    async () => toolResult(() => listProjects(client)),
  );

  server.registerTool(
    "project_list_members",
    {
      description: "List a project's members and their roles.",
      inputSchema: { project: z.string().describe("Project name or id") },
    },
    async (args) => toolResult(() => listProjectMembers(client, args)),
  );

  server.registerTool(
    "project_add_member",
    {
      description: "Add a person to a project (or change their role). Requires you to be a project admin.",
      inputSchema: {
        project: z.string().describe("Project name or id"),
        user: z.string().describe("Email or name"),
        role: z.enum(["admin", "member"]).optional().describe("Defaults to member"),
      },
    },
    async (args) => toolResult(() => addProjectMember(client, args)),
  );

  server.registerTool(
    "project_remove_member",
    {
      description: "Remove a person from a project. Requires you to be a project admin; refuses to remove the last admin.",
      inputSchema: {
        project: z.string().describe("Project name or id"),
        user: z.string().describe("Email or name"),
      },
    },
    async (args) => toolResult(() => removeProjectMember(client, args)),
  );
}
