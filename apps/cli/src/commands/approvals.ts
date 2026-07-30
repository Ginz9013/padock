import type { Command } from "commander";
import { createClient, run } from "../client.ts";
import { listApprovals, getApprovalStatus } from "../actions/approvals.ts";

export function registerApprovalsCommands(program: Command): void {
  const approvals = program.command("approvals");

  approvals.command("list").action(async () => {
    const client = createClient();
    await run(() => listApprovals(client));
  });

  approvals.command("status <id>").action(async (id: string) => {
    const client = createClient();
    await run(() => getApprovalStatus(client, { id }));
  });
}
