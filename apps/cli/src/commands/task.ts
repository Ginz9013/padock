import type { Command } from "commander";
import { createClient, run } from "../client.ts";
import { resolveProjectId, resolveTaskStateId } from "../resolve.ts";

export function registerTaskCommands(program: Command): void {
  const task = program.command("task");

  task
    .command("create")
    .requiredOption("--project <nameOrId>")
    .requiredOption("--title <title>")
    .option("--description <text>")
    .action(async (opts: { project: string; title: string; description?: string }) => {
      const client = createClient();
      await run(async () => {
        const projectId = await resolveProjectId(client, opts.project);
        return client.task.create.mutate({
          projectId,
          title: opts.title,
          description: opts.description,
        });
      });
    });

  task
    .command("list")
    .requiredOption("--project <nameOrId>")
    .action(async (opts: { project: string }) => {
      const client = createClient();
      await run(async () => {
        const projectId = await resolveProjectId(client, opts.project);
        return client.task.list.query({ projectId });
      });
    });

  task
    .command("update <id>")
    .requiredOption("--status <name>", "a task state name in the task's own project (project-specific, not a fixed enum — see task-state list)")
    .action(async (id: string, opts: { status: string }) => {
      const client = createClient();
      await run(async () => {
        const existing = await client.task.get.query({ id });
        const stateId = await resolveTaskStateId(client, existing.projectId, opts.status);
        return client.task.updateState.mutate({ id, stateId });
      });
    });
}
