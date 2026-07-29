import type { Command } from "commander";
import { createClient, run } from "../client.ts";
import { createTask, listTasks, updateTaskStatus } from "../actions/task.ts";

export function registerTaskCommands(program: Command): void {
  const task = program.command("task");

  task
    .command("create")
    .requiredOption("--project <nameOrId>")
    .requiredOption("--title <title>")
    .option("--description <text>")
    .action(async (opts: { project: string; title: string; description?: string }) => {
      const client = createClient();
      await run(() => createTask(client, opts));
    });

  task
    .command("list")
    .requiredOption("--project <nameOrId>")
    .action(async (opts: { project: string }) => {
      const client = createClient();
      await run(() => listTasks(client, opts));
    });

  task
    .command("update <id>")
    .requiredOption("--status <name>", "a task state name in the task's own project (project-specific, not a fixed enum — see task-state list)")
    .action(async (id: string, opts: { status: string }) => {
      const client = createClient();
      await run(() => updateTaskStatus(client, { id, status: opts.status }));
    });
}
