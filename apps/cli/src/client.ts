import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "@padock/api";
import { readConfig, type PadockConfig } from "./config.ts";

export function createClientFrom(config: PadockConfig) {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `${config.serverUrl}/api/trpc`,
        headers: () => ({ "x-api-key": config.apiKey }),
      }),
    ],
  });
}

export function createClient() {
  return createClientFrom(readConfig());
}

export async function run(fn: () => Promise<unknown>): Promise<void> {
  try {
    const result = await fn();
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    // err instanceof Error covers both TRPCClientError (server-side
    // failures) and plain Error (e.g. actions/chat.ts's validation
    // throw) — using .message instead of String(err) avoids a
    // doubled "Error: Error: ..." prefix (Error#toString() already
    // includes one).
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Error: ${message}`);
    process.exit(1);
  }
}
