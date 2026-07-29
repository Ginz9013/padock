import type { Command } from "commander";
import { createClient, run } from "../client.ts";
import { resolveProjectId } from "../resolve.ts";

export function registerSearchCommand(program: Command): void {
  program
    .command("search <query>")
    .option("--scope <domains>", "comma-separated: docs,tasks,chat")
    .option("--project <nameOrId>")
    .action(async (query: string, opts: { scope?: string; project?: string }) => {
      const client = createClient();
      await run(async () => {
        const scope = opts.scope
          ? (opts.scope.split(",") as ("docs" | "tasks" | "chat")[])
          : undefined;
        const projectId = opts.project ? await resolveProjectId(client, opts.project) : undefined;
        return client.search.search.query({ query, scope, projectId });
      });
    });
}
