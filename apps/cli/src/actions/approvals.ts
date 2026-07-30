import type { createClient } from "../client.ts";

type Client = ReturnType<typeof createClient>;

export async function listApprovals(client: Client) {
  return client.approval.mine.query();
}

export async function getApprovalStatus(client: Client, args: { id: string }) {
  return client.approval.status.query({ id: args.id });
}
