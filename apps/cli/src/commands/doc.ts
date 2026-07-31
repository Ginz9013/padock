import { readFileSync } from "node:fs";
import type { Command } from "commander";
import { createClient, run } from "../client.ts";
import { createDoc, listDocs, getDoc, updateDoc, deleteDoc } from "../actions/doc.ts";

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
      await run(() => createDoc(client, { project: opts.project, title: opts.title, content }));
    });

  doc
    .command("list")
    .requiredOption("--project <nameOrId>")
    .action(async (opts: { project: string }) => {
      const client = createClient();
      await run(() => listDocs(client, opts));
    });

  doc.command("get <id>").action(async (id: string) => {
    const client = createClient();
    await run(() => getDoc(client, { id }));
  });

  doc
    .command("update <id>")
    .option("--title <title>")
    .option("--content <text>")
    .option("--file <path>")
    .action(async (id: string, opts: { title?: string; content?: string; file?: string }) => {
      const client = createClient();
      const content = opts.content !== undefined || opts.file ? readContent(opts) : undefined;
      await run(() => updateDoc(client, { id, title: opts.title, content }));
    });

  doc.command("delete <id>").action(async (id: string) => {
    const client = createClient();
    await run(() => deleteDoc(client, { id }));
  });
}
