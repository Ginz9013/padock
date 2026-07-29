import type { Command } from "commander";
import { createClient, run } from "../client.ts";

export function registerUserCommands(program: Command): void {
  const user = program.command("user");

  user.command("list").action(async () => {
    const client = createClient();
    await run(() => client.user.list.query());
  });
}
