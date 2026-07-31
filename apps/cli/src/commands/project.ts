import type { Command } from "commander";
import { createClient, run } from "../client.ts";
import {
  createProject,
  listProjects,
  listProjectMembers,
  addProjectMember,
  removeProjectMember,
} from "../actions/project.ts";

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

  project
    .command("members <project>")
    .action(async (projectArg: string) => {
      const client = createClient();
      await run(() => listProjectMembers(client, { project: projectArg }));
    });

  project
    .command("add-member <project>")
    .requiredOption("--user <emailOrNameOrId>")
    .option("--role <role>", "admin|member", "member")
    .action(async (projectArg: string, opts: { user: string; role?: string }) => {
      const client = createClient();
      await run(() => addProjectMember(client, { project: projectArg, user: opts.user, role: opts.role }));
    });

  project
    .command("remove-member <project>")
    .requiredOption("--user <emailOrNameOrId>")
    .action(async (projectArg: string, opts: { user: string }) => {
      const client = createClient();
      await run(() => removeProjectMember(client, { project: projectArg, user: opts.user }));
    });
}
