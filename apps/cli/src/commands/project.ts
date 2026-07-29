import type { Command } from "commander";
import { createClient, run } from "../client.ts";
import { createProject, listProjects } from "../actions/project.ts";

export function registerProjectCommands(program: Command): void {
  const project = program.command("project");

  project.command("create <name>").action(async (name: string) => {
    const client = createClient();
    await run(() => createProject(client, { name }));
  });

  project.command("list").action(async () => {
    const client = createClient();
    await run(() => listProjects(client));
  });
}
