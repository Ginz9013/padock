import type { Command } from "commander";
import { createClient, run } from "../client.ts";
import { createTaskState, listTaskStates } from "../actions/taskState.ts";

export function registerTaskStateCommands(program: Command): void {
  const taskState = program.command("task-state");

  taskState
    .command("create")
    .requiredOption("--project <nameOrId>")
    .requiredOption("--name <name>")
    .requiredOption("--group <group>", "backlog|unstarted|started|completed|cancelled")
    .option("--default", "make this the state new tasks land in")
    .action(
      async (opts: {
        project: string;
        name: string;
        group: "backlog" | "unstarted" | "started" | "completed" | "cancelled";
        default?: boolean;
      }) => {
        const client = createClient();
        await run(() =>
          createTaskState(client, {
            project: opts.project,
            name: opts.name,
            group: opts.group,
            isDefault: opts.default,
          }),
        );
      },
    );

  taskState
    .command("list")
    .requiredOption("--project <nameOrId>")
    .action(async (opts: { project: string }) => {
      const client = createClient();
      await run(() => listTaskStates(client, opts));
    });
}
