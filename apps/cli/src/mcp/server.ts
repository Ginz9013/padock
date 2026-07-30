import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createClient } from "../client.ts";
import { version } from "../../package.json";
import { registerProjectTools } from "./tools/project.ts";
import { registerTaskTools } from "./tools/task.ts";
import { registerTaskStateTools } from "./tools/taskState.ts";
import { registerDocTools } from "./tools/doc.ts";
import { registerChatTools } from "./tools/chat.ts";
import { registerChannelTools } from "./tools/channel.ts";
import { registerUserTools } from "./tools/user.ts";
import { registerSearchTools } from "./tools/search.ts";
import { registerApprovalsTools } from "./tools/approvals.ts";

// Full parity with the padock command grammar (§5.2), as an optional
// richer transport for MCP-capable clients (§5.3/Phase 5) — reuses
// the exact same actions/*.ts logic and ~/.config/padock/ auth the
// CLI itself uses. `login`/`init-skill` are one-time human setup
// steps, not exposed as tools.
export async function startMcpServer(): Promise<void> {
  const client = createClient();
  const server = new McpServer({ name: "padock", version });

  registerProjectTools(server, client);
  registerTaskTools(server, client);
  registerTaskStateTools(server, client);
  registerDocTools(server, client);
  registerChatTools(server, client);
  registerChannelTools(server, client);
  registerUserTools(server, client);
  registerSearchTools(server, client);
  registerApprovalsTools(server, client);

  server.registerTool(
    "whoami",
    { description: "Check which Padock user the current login is authenticated as." },
    async () => {
      const me = await client.whoami.query();
      return { content: [{ type: "text" as const, text: JSON.stringify(me, null, 2) }] };
    },
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
