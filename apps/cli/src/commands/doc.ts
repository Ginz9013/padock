import { readFileSync } from "node:fs";
import type { Command } from "commander";
import { createClient, run } from "../client.ts";
import { resolveProjectId } from "../resolve.ts";

function readContent(opts: { content?: string; file?: string }): string {
  if (opts.file) {
    return readFileSync(opts.file, "utf-8");
  }
  if (opts.content !== undefined) {
    return opts.content;
  }
  console.error("Error: provide either --content or --file");
  process.exit(1);
}

export function registerDocCommands(program: Command): void {
  const doc = program.command("doc");

  doc
    .command("create")
    .requiredOption("--project <nameOrId>")
    .requiredOption("--title <title>")
    .option("--content <text>")
    .option("--file <path>")
    .action(async (opts: { project: string; title: string; content?: string; file?: string }) => {
      const client = createClient();
      const content = readContent(opts);
      await run(async () => {
        const projectId = await resolveProjectId(client, opts.project);
        return client.doc.create.mutate({ projectId, title: opts.title, content });
      });
    });

  doc
    .command("list")
    .requiredOption("--project <nameOrId>")
    .action(async (opts: { project: string }) => {
      const client = createClient();
      await run(async () => {
        const projectId = await resolveProjectId(client, opts.project);
        return client.doc.list.query({ projectId });
      });
    });

  doc.command("get <id>").action(async (id: string) => {
    const client = createClient();
    await run(() => client.doc.get.query({ id }));
  });

  doc
    .command("update <id>")
    .option("--title <title>")
    .option("--content <text>")
    .option("--file <path>")
    .action(async (id: string, opts: { title?: string; content?: string; file?: string }) => {
      const client = createClient();
      const content = opts.content !== undefined || opts.file ? readContent(opts) : undefined;
      await run(() => client.doc.update.mutate({ id, title: opts.title, content }));
    });
}
