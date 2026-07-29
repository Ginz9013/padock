import type { Command } from "commander";
import { createClient, run } from "../client.ts";
import { resolveChannelId } from "../resolve.ts";

export function registerTopicCommands(program: Command): void {
  const topic = program.command("topic");

  topic
    .command("create")
    .requiredOption("--channel <nameOrId>")
    .requiredOption("--title <title>")
    .action(async (opts: { channel: string; title: string }) => {
      const client = createClient();
      await run(async () => {
        const channelId = await resolveChannelId(client, opts.channel);
        return client.topic.create.mutate({ channelId, title: opts.title });
      });
    });

  topic
    .command("list")
    .requiredOption("--channel <nameOrId>")
    .action(async (opts: { channel: string }) => {
      const client = createClient();
      await run(async () => {
        const channelId = await resolveChannelId(client, opts.channel);
        return client.topic.list.query({ channelId });
      });
    });
}
