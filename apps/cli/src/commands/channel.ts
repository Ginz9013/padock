import type { Command } from "commander";
import { createClient, run } from "../client.ts";
import { resolveProjectId } from "../resolve.ts";

export function registerChannelCommands(program: Command): void {
  const channel = program.command("channel");

  channel
    .command("create <name>")
    .option("--project <nameOrId>")
    .action(async (name: string, opts: { project?: string }) => {
      const client = createClient();
      await run(async () => {
        const projectId = opts.project ? await resolveProjectId(client, opts.project) : undefined;
        return client.channel.create.mutate({ name, projectId });
      });
    });

  channel
    .command("list")
    .option("--project <nameOrId>")
    .action(async (opts: { project?: string }) => {
      const client = createClient();
      await run(async () => {
        const projectId = opts.project ? await resolveProjectId(client, opts.project) : undefined;
        return client.channel.list.query(projectId ? { projectId } : undefined);
      });
    });
}
