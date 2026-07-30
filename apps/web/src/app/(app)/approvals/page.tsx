"use client";

import { useEffect, useState } from "react";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "@padock/api";

import { Button } from "@/components/ui/button";

const trpc = createTRPCClient<AppRouter>({
  links: [httpBatchLink({ url: "/api/trpc" })],
});

// Hand-written rather than derived via Awaited<ReturnType<...>> — the
// latter forces TS to instantiate through approval.ts's own
// AppRouter-typed callTRPCProcedure call and blows the compiler's
// recursion limit (TS2589) in this app's tsconfig.
type ApprovalRequest = {
  id: string;
  userId: string;
  path: string;
  input: unknown;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
};

// Phase 6b: the human review surface for writes queued by
// "unattended"-flagged PATs (packages/api/src/approvalGate.ts) —
// session-only (matches apikey.create's own human-only gating), same
// minimal style as the existing debug page (no UI library, no React
// Query — just fetch-on-mount + a manual refresh button).
export default function ApprovalsPage() {
  const [pending, setPending] = useState<ApprovalRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refresh() {
    try {
      setError(null);
      setPending(await trpc.approval.list.query());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    // Standard fetch-on-mount: refresh()'s setState calls happen after its
    // internal `await`, not synchronously in this effect body — safe, but
    // the lint rule can't see through the indirection to confirm that.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, []);

  async function decide(id: string, action: "approve" | "reject") {
    setBusyId(id);
    try {
      if (action === "approve") {
        await trpc.approval.approve.mutate({ id });
      } else {
        await trpc.approval.reject.mutate({ id });
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Approval queue</h1>
        <p className="text-sm text-muted-foreground">
          Writes submitted by unattended (scheduled/cron) API keys wait here until a
          signed-in user approves or rejects them.
        </p>
      </div>

      <Button variant="outline" size="sm" className="w-fit" onClick={refresh}>
        Refresh
      </Button>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {pending.length === 0 ? (
        <p className="text-sm text-muted-foreground">No pending requests.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {pending.map((request) => (
            <li key={request.id} className="rounded-lg border p-3">
              <p className="font-mono text-sm">{request.path}</p>
              <pre className="mt-1 max-h-40 overflow-auto rounded bg-muted p-2 text-xs">
                {JSON.stringify(request.input, null, 2)}
              </pre>
              <p className="mt-1 text-xs text-muted-foreground">
                submitted by user {request.userId} at{" "}
                {new Date(request.createdAt).toLocaleString()}
              </p>
              <div className="mt-2 flex gap-2">
                <Button
                  size="sm"
                  disabled={busyId === request.id}
                  onClick={() => decide(request.id, "approve")}
                >
                  Approve
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busyId === request.id}
                  onClick={() => decide(request.id, "reject")}
                >
                  Reject
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
