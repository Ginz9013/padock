import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { createClient } from "../../client.ts";
import { createDoc, listDocs, getDoc, updateDoc, deleteDoc } from "../../actions/doc.ts";
import { toolResult } from "../toolResult.ts";

type Client = ReturnType<typeof createClient>;

export function registerDocTools(server: McpServer, client: Client): void {
  server.registerTool(
    "doc_create",
    {
      description: "Create a doc in a project. `content` is Markdown text.",
      inputSchema: {
        project: z.string().describe("Project name or id"),
        title: z.string(),
        content: z.string().describe("Markdown content"),
      },
    },
    async (args) => toolResult(() => createDoc(client, args)),
  );

  server.registerTool(
    "doc_list",
    {
      description: "List docs in a project.",
      inputSchema: { project: z.string().describe("Project name or id") },
    },
    async (args) => toolResult(() => listDocs(client, args)),
  );

  server.registerTool(
    "doc_get",
    {
      description: "Read a doc's content (returned as Markdown).",
      inputSchema: { id: z.string() },
    },
    async (args) => toolResult(() => getDoc(client, args)),
  );

  server.registerTool(
    "doc_update",
    {
      description: "Update a doc's title and/or content (Markdown).",
      inputSchema: {
        id: z.string(),
        title: z.string().optional(),
        content: z.string().optional(),
      },
    },
    async (args) => toolResult(() => updateDoc(client, args)),
  );

  server.registerTool(
    "doc_delete",
    {
      description: "Delete a doc.",
      inputSchema: { id: z.string() },
    },
    async (args) => toolResult(() => deleteDoc(client, args)),
  );
}
