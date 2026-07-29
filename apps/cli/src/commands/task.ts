import type { Command } from "commander";
import { createClient, run } from "../client.ts";
import { resolveProjectId } from "../resolve.ts";

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
    .requiredOption("--status <status>", "todo|in_progress|review|done")
    .action(async (id: string, opts: { status: "todo" | "in_progress" | "review" | "done" }) => {
      const client = createClient();
      await run(() => client.task.updateStatus.mutate({ id, status: opts.status }));
    });
}
