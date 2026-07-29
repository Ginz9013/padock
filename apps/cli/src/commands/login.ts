import type { Command } from "commander";
import { createClient, createClientFrom, run } from "../client.ts";
import { writeConfig } from "../config.ts";
import { version as cliVersion } from "../../package.json";

export function registerLoginCommand(program: Command): void {
  program
    .command("login")
    .requiredOption("--token <key>", "API key generated from the web UI's settings page")
    .option("--server <url>", "Padock server URL", "http://localhost:3000")
    .action(async (opts: { token: string; server: string }) => {
      const client = createClientFrom({ serverUrl: opts.server, apiKey: opts.token });

      // Validate before persisting — a bad token shouldn't get saved
      // silently (CONTEXT.md §5.1.1's login flow).
      let user;
      try {
        user = await client.whoami.query();
      } catch (err) {
        console.error(`Login failed: could not verify token against ${opts.server}`);
        console.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }

      writeConfig({ serverUrl: opts.server, apiKey: opts.token });
      console.log(`Logged in as ${user.name} <${user.email}> (${opts.server})`);

      try {
        const res = await fetch(`${opts.server}/api/version`);
        const { version: serverVersion } = (await res.json()) as { version: string };
        if (serverVersion !== cliVersion) {
          console.warn(
            `Warning: CLI version (${cliVersion}) does not match server version (${serverVersion}).`,
          );
        }
      } catch {
        console.warn("Warning: could not reach /api/version for the version check.");
      }
    });
}

export function registerWhoamiCommand(program: Command): void {
  program.command("whoami").action(async () => {
    const client = createClient();
    await run(() => client.whoami.query());
  });
}
