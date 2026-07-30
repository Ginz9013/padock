import type { Command } from "commander";
import { createClient, run } from "../client.ts";
import {
  createTask,
  listTasks,
  updateTaskStatus,
  updateTaskPriority,
  updateTaskDates,
  updateTaskAssignees,
} from "../actions/task.ts";

const PRIORITY_HELP = "urgent|high|medium|low|none";

export function registerTaskCommands(program: Command): void {
  const task = program.command("task");

  task
    .command("create")
    .requiredOption("--project <nameOrId>")
    .requiredOption("--title <title>")
    .option("--description <text>")
    .option("--priority <priority>", PRIORITY_HELP)
    .option("--start-date <date>", "ISO date")
    .option("--end-date <date>", "ISO date")
    .option("--assignees <list>", "comma-separated emails/names/ids — must already be project members")
    .action(
      async (opts: {
        project: string;
        title: string;
        description?: string;
        priority?: string;
        startDate?: string;
        endDate?: string;
        assignees?: string;
      }) => {
        const client = createClient();
        await run(() =>
          createTask(client, {
            ...opts,
            assignees: opts.assignees ? opts.assignees.split(",") : undefined,
          }),
        );
      },
    );

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

  task
    .command("priority <id>")
    .requiredOption("--value <priority>", PRIORITY_HELP)
    .action(async (id: string, opts: { value: string }) => {
      const client = createClient();
      await run(() => updateTaskPriority(client, { id, priority: opts.value }));
    });

  task
    .command("dates <id>")
    .option("--start <date>", "ISO date")
    .option("--end <date>", "ISO date")
    .option("--clear-start", "clear the start date")
    .option("--clear-end", "clear the end date")
    .action(
      async (id: string, opts: { start?: string; end?: string; clearStart?: boolean; clearEnd?: boolean }) => {
        const client = createClient();
        await run(() =>
          updateTaskDates(client, {
            id,
            startDate: opts.start,
            endDate: opts.end,
            clearStart: opts.clearStart,
            clearEnd: opts.clearEnd,
          }),
        );
      },
    );

  task
    .command("assignees <id>")
    .requiredOption("--set <list>", "comma-separated emails/names/ids — replaces the current assignee list, must already be project members")
    .action(async (id: string, opts: { set: string }) => {
      const client = createClient();
      await run(() => updateTaskAssignees(client, { id, assignees: opts.set.split(",") }));
    });
}
