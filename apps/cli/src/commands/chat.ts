import type { Command } from "commander";
import { createClient, run } from "../client.ts";
import { resolveProjectId, resolveUserId, resolveChannelId, resolveTopicId } from "../resolve.ts";

export function registerChatCommands(program: Command): void {
  const chat = program.command("chat");

  chat
    .command("send")
    .option("--to <emailOrNameOrId>", "DM recipient — mutually exclusive with --channel/--topic")
    .option("--channel <nameOrId>", "channel to post to — requires --topic")
    .option("--topic <titleOrId>", "topic within --channel")
    .requiredOption("--message <text>")
    .option("--project <nameOrId>", "DM only — tag the message with a project")
    .action(
      async (opts: { to?: string; channel?: string; topic?: string; message: string; project?: string }) => {
        const client = createClient();
        await run(async () => {
          if (opts.to) {
            const recipientId = await resolveUserId(client, opts.to);
            const projectId = opts.project ? await resolveProjectId(client, opts.project) : undefined;
            return client.chat.send.mutate({ recipientId, content: opts.message, projectId });
          }
          if (opts.channel && opts.topic) {
            const channelId = await resolveChannelId(client, opts.channel);
            const topicId = await resolveTopicId(client, channelId, opts.topic);
            return client.chat.send.mutate({ channelId, topicId, content: opts.message });
          }
          console.error("Error: provide either --to, or both --channel and --topic");
          process.exit(1);
        });
      },
    );

  chat
    .command("conversation")
    .requiredOption("--with <emailOrNameOrId>")
    .action(async (opts: { with: string }) => {
      const client = createClient();
      await run(async () => {
        const withUserId = await resolveUserId(client, opts.with);
        return client.chat.conversation.query({ withUserId });
      });
    });

  chat
    .command("history")
    .requiredOption("--channel <nameOrId>")
    .requiredOption("--topic <titleOrId>")
    .action(async (opts: { channel: string; topic: string }) => {
      const client = createClient();
      await run(async () => {
        const channelId = await resolveChannelId(client, opts.channel);
        const topicId = await resolveTopicId(client, channelId, opts.topic);
        return client.chat.history.query({ channelId, topicId });
      });
    });

  chat.command("inbox").action(async () => {
    const client = createClient();
    await run(() => client.chat.inbox.query());
  });
}
