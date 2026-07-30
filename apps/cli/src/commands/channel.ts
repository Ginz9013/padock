import type { Command } from "commander";
import { createClient, run } from "../client.ts";
import { createChannel, listChannels } from "../actions/channel.ts";

export function registerChannelCommands(program: Command): void {
  const channel = program.command("channel");

  channel
    .command("create <title>")
    .option("--project <nameOrId>", "omit for an org-wide channel")
    .action(async (title: string, opts: { project?: string }) => {
      const client = createClient();
      await run(() => createChannel(client, { title, project: opts.project }));
    });

  channel
    .command("list")
    .option("--project <nameOrId>")
    .action(async (opts: { project?: string }) => {
      const client = createClient();
      await run(() => listChannels(client, opts));
    });
}
