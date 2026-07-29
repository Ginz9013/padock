import { createTRPCClient, httpBatchLink, TRPCClientError } from "@trpc/client";
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
    const message = err instanceof TRPCClientError ? err.message : String(err);
    console.error(`Error: ${message}`);
    process.exit(1);
  }
}
