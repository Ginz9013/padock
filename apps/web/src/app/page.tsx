"use client";

import { useState } from "react";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "@padock/api";

const trpc = createTRPCClient<AppRouter>({
  links: [httpBatchLink({ url: "/api/trpc" })],
});

export default function Home() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const [apiKey, setApiKey] = useState<string | null>(null);

  function append(line: string) {
    setLog((prev) => [...prev, line]);
  }

  async function signUp() {
    const res = await fetch("/api/auth/sign-up/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    append(`sign-up: ${res.status} ${await res.text()}`);
  }

  async function signIn() {
    const res = await fetch("/api/auth/sign-in/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    append(`sign-in: ${res.status} ${await res.text()}`);
  }

  async function callHealth() {
    const result = await trpc.health.query();
    append(`health: ${JSON.stringify(result)}`);
  }

  async function callWhoami() {
    try {
      const result = await trpc.whoami.query();
      append(`whoami: ${JSON.stringify(result)}`);
    } catch (err) {
      append(`whoami error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function createApiKey() {
    const res = await fetch("/api/auth/api-key/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "padock-cli" }),
    });
    const data = await res.json();
    append(`api-key create: ${res.status} ${JSON.stringify(data)}`);
    if (typeof data.key === "string") {
      setApiKey(data.key);
    }
  }

  async function callWhoamiWithApiKey() {
    const res = await fetch("/api/trpc/whoami", {
      headers: apiKey ? { "x-api-key": apiKey } : {},
    });
    append(`whoami (x-api-key): ${res.status} ${await res.text()}`);
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 p-8 font-sans">
      <h1 className="text-2xl font-semibold">Padock — Phase 0 skeleton</h1>
      <p className="text-sm text-zinc-500">
        Verifies: Better Auth email/password, tRPC + Prisma health check, and
        the API Key (PAT) auth path a CLI would use.
      </p>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">1. Register / sign in</h2>
        <input
          className="rounded border px-2 py-1"
          placeholder="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="rounded border px-2 py-1"
          placeholder="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="rounded border px-2 py-1"
          placeholder="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <div className="flex gap-2">
          <button className="rounded bg-black px-3 py-1 text-white" onClick={signUp}>
            Sign up
          </button>
          <button className="rounded border px-3 py-1" onClick={signIn}>
            Sign in
          </button>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">2. tRPC + Prisma</h2>
        <div className="flex gap-2">
          <button className="rounded border px-3 py-1" onClick={callHealth}>
            Call health (public)
          </button>
          <button className="rounded border px-3 py-1" onClick={callWhoami}>
            Call whoami (session)
          </button>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">3. API Key (PAT) — the CLI&apos;s auth path</h2>
        <div className="flex gap-2">
          <button className="rounded border px-3 py-1" onClick={createApiKey}>
            Create API key
          </button>
          <button className="rounded border px-3 py-1" onClick={callWhoamiWithApiKey}>
            Call whoami with x-api-key
          </button>
        </div>
        {apiKey && (
          <p className="break-all text-xs text-zinc-500">key: {apiKey}</p>
        )}
      </section>

      <section className="flex flex-col gap-1">
        <h2 className="font-medium">Log</h2>
        <pre className="max-h-64 overflow-auto rounded bg-zinc-100 p-2 text-xs dark:bg-zinc-900">
          {log.join("\n")}
        </pre>
      </section>
    </div>
  );
}
