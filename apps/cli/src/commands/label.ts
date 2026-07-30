import type { Command } from "commander";
import { createClient, run } from "../client.ts";
import { createLabel, listLabels, deleteLabel } from "../actions/label.ts";

export function registerLabelCommands(program: Command): void {
  const label = program.command("label");

  label
    .command("create")
    .requiredOption("--project <nameOrId>")
    .requiredOption("--name <name>")
    .requiredOption("--color <hex>", "e.g. #f97316")
    .action(async (opts: { project: string; name: string; color: string }) => {
      const client = createClient();
      await run(() => createLabel(client, opts));
    });

  label
    .command("list")
    .requiredOption("--project <nameOrId>")
    .action(async (opts: { project: string }) => {
      const client = createClient();
      await run(() => listLabels(client, opts));
    });

  label
    .command("delete <nameOrId>")
    .requiredOption("--project <nameOrId>")
    .action(async (nameOrId: string, opts: { project: string }) => {
      const client = createClient();
      await run(() => deleteLabel(client, { project: opts.project, label: nameOrId }));
    });
}
