import type { Command } from "commander";
import { createClient, run } from "../client.ts";
import { sendMessage, getConversation, getChatHistory, getInbox } from "../actions/chat.ts";

export function registerChatCommands(program: Command): void {
  const chat = program.command("chat");

  chat
    .command("send")
    .option("--to <emailOrNameOrId>", "DM recipient — mutually exclusive with --channel")
    .option("--channel <nameOrId>", "channel to post to")
    .requiredOption("--message <text>")
    .option(
      "--project <nameOrId>",
      "with --to: tag the DM with a project. With --channel: scope the channel name lookup (required to resolve a project-scoped channel by name, must also already be a member of it)",
    )
    .action(async (opts: { to?: string; channel?: string; message: string; project?: string }) => {
      const client = createClient();
      await run(() => sendMessage(client, opts));
    });

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
    .option("--project <nameOrId>", "scope the channel name lookup to a project's channels")
    .action(async (opts: { channel: string; project?: string }) => {
      const client = createClient();
      await run(() => getChatHistory(client, opts));
    });

  chat.command("inbox").action(async () => {
    const client = createClient();
    await run(() => getInbox(client));
  });
}
