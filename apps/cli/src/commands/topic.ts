import type { Command } from "commander";
import { createClient, run } from "../client.ts";
import { createTopic, listTopics } from "../actions/topic.ts";

export function registerTopicCommands(program: Command): void {
  const topic = program.command("topic");

  topic
    .command("create")
    .requiredOption("--channel <nameOrId>")
    .requiredOption("--title <title>")
    .action(async (opts: { channel: string; title: string }) => {
      const client = createClient();
      await run(() => createTopic(client, opts));
    });

  topic
    .command("list")
    .requiredOption("--channel <nameOrId>")
    .action(async (opts: { channel: string }) => {
      const client = createClient();
      await run(() => listTopics(client, opts));
    });
}
