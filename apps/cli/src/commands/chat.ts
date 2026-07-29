import type { Command } from "commander";
import { createClient, run } from "../client.ts";
import { sendMessage, getConversation, getChatHistory, getInbox } from "../actions/chat.ts";

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
        await run(() => sendMessage(client, opts));
      },
    );

  chat
    .command("conversation")
    .requiredOption("--with <emailOrNameOrId>")
    .action(async (opts: { with: string }) => {
      const client = createClient();
      await run(() => getConversation(client, opts));
    });

  chat
    .command("history")
    .requiredOption("--channel <nameOrId>")
    .requiredOption("--topic <titleOrId>")
    .action(async (opts: { channel: string; topic: string }) => {
      const client = createClient();
      await run(() => getChatHistory(client, opts));
    });

  chat.command("inbox").action(async () => {
    const client = createClient();
    await run(() => getInbox(client));
  });
}
