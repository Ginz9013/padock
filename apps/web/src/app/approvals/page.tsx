"use client";

import { useEffect, useState } from "react";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "@padock/api";

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
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-8 font-sans">
      <h1 className="text-2xl font-semibold">Padock — Approval queue</h1>
      <p className="text-sm text-zinc-500">
        Writes submitted by unattended (scheduled/cron) API keys wait here until a
        signed-in user approves or rejects them.
      </p>

      <button className="w-fit rounded border px-3 py-1" onClick={refresh}>
        Refresh
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {pending.length === 0 ? (
        <p className="text-sm text-zinc-500">No pending requests.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {pending.map((request) => (
            <li key={request.id} className="rounded border p-3">
              <p className="font-mono text-sm">{request.path}</p>
              <pre className="mt-1 max-h-40 overflow-auto rounded bg-zinc-100 p-2 text-xs dark:bg-zinc-900">
                {JSON.stringify(request.input, null, 2)}
              </pre>
              <p className="mt-1 text-xs text-zinc-500">
                submitted by user {request.userId} at{" "}
                {new Date(request.createdAt).toLocaleString()}
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  className="rounded bg-black px-3 py-1 text-sm text-white disabled:opacity-50"
                  disabled={busyId === request.id}
                  onClick={() => decide(request.id, "approve")}
                >
                  Approve
                </button>
                <button
                  className="rounded border px-3 py-1 text-sm disabled:opacity-50"
                  disabled={busyId === request.id}
                  onClick={() => decide(request.id, "reject")}
                >
                  Reject
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
