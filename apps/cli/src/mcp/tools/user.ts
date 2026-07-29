import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { createClient } from "../../client.ts";
import { listUsers } from "../../actions/user.ts";
import { toolResult } from "../toolResult.ts";

type Client = ReturnType<typeof createClient>;

export function registerUserTools(server: McpServer, client: Client): void {
  server.registerTool(
    "user_list",
    { description: "List org members — needed to find a chat recipient's id/email/name." },
    async () => toolResult(() => listUsers(client)),
  );
}
