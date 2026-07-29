import type { Command } from "commander";
import { createClient, run } from "../client.ts";
import { search } from "../actions/search.ts";

export function registerSearchCommand(program: Command): void {
  program
    .command("search <query>")
    .option("--scope <domains>", "comma-separated: docs,tasks,chat")
    .option("--project <nameOrId>")
    .action(async (query: string, opts: { scope?: string; project?: string }) => {
      const client = createClient();
      await run(() => {
        const scope = opts.scope
          ? (opts.scope.split(",") as ("docs" | "tasks" | "chat")[])
          : undefined;
        return search(client, { query, scope, project: opts.project });
      });
    });
}
