import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { createClient } from "../../client.ts";
import { listApprovals, getApprovalStatus } from "../../actions/approvals.ts";
import { toolResult } from "../toolResult.ts";

type Client = ReturnType<typeof createClient>;

export function registerApprovalsTools(server: McpServer, client: Client): void {
  server.registerTool(
    "approval_list",
    {
      description:
        "List this key's own submitted approval requests (writes queued because the key is unattended-flagged).",
    },
    async () => toolResult(() => listApprovals(client)),
  );

  server.registerTool(
    "approval_status",
    {
      description: "Check the status of a specific approval request by id.",
      inputSchema: { id: z.string() },
    },
    async (args) => toolResult(() => getApprovalStatus(client, args)),
  );
}
