import type { Command } from "commander";
import { createClient, run } from "../client.ts";
import { resolveProjectId, resolveUserId } from "../resolve.ts";

export function registerChatCommands(program: Command): void {
  const chat = program.command("chat");

  chat
    .command("send")
    .requiredOption("--to <emailOrNameOrId>")
    .requiredOption("--message <text>")
    .option("--project <nameOrId>")
    .action(async (opts: { to: string; message: string; project?: string }) => {
      const client = createClient();
      await run(async () => {
        const recipientId = await resolveUserId(client, opts.to);
        const projectId = opts.project ? await resolveProjectId(client, opts.project) : undefined;
        return client.chat.send.mutate({ recipientId, content: opts.message, projectId });
      });
    });

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

  chat.command("inbox").action(async () => {
    const client = createClient();
    await run(() => client.chat.inbox.query());
  });
}
