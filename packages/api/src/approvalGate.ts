import type { PrismaClient, Prisma } from "@padock/db";
import type { PadockUser } from "@padock/auth";

// Phase 6b: a scheduled/cron-type agent has nobody watching its
// conversation turn, so confirm-before-act (CONTEXT.md §4) can't be
// "the agent's own turn" the way it is for interactive agents. A key
// flagged `unattended` at creation gets every write queued here
// instead of executed — a human reviews it later on the web
// /approvals page. Called as the first line of every write-scoped
// resolver body (same call sites Phase 6's scopedProcedure already
// touches), not a tRPC middleware: middleware can only `next()` or
// `throw`, it can't fabricate a successful response (verified against
// @trpc/server's MiddlewareResult typing — its `marker` field is
// branded with an unexported internal symbol).
export async function runOrQueue<T>(
  ctx: { db: PrismaClient; user: PadockUser; unattended: boolean },
  path: string,
  input: unknown,
  execute: () => Promise<T>,
): Promise<T | { status: "pending_approval"; approvalId: string }> {
  if (!ctx.unattended) {
    return execute();
  }
  const request = await ctx.db.approvalRequest.create({
    data: { userId: ctx.user.id, path, input: input as Prisma.InputJsonValue },
  });
  return { status: "pending_approval" as const, approvalId: request.id };
}
