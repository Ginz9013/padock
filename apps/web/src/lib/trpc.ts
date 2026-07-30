import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "@padock/api";

// Shared client for every "use client" page's fetch-on-mount calls
// (CONTEXT.md §6 "Rendering model" — no Server Component data-fetching).
export const trpc = createTRPCClient<AppRouter>({
  links: [httpBatchLink({ url: "/api/trpc" })],
});

type PendingApproval = { status: "pending_approval"; approvalId: string };

// Every write resolver runs through runOrQueue (packages/api/src/
// approvalGate.ts) and is typed as `T | PendingApproval`, but
// `unattended` is a PAT-only flag set at API-key creation — a browser
// session can never carry it, so this union member is unreachable for
// the web UI in practice. Narrows the type at each write call site
// instead of repeating a guard everywhere.
export function unwrapWrite<T>(result: T | PendingApproval): T {
  if (typeof result === "object" && result !== null && "status" in result && result.status === "pending_approval") {
    throw new Error("Unexpected: a browser session write was queued for approval.");
  }
  return result as T;
}
