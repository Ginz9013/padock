import type { createClient } from "../client.ts";
import { resolveProjectId } from "../resolve.ts";

type Client = ReturnType<typeof createClient>;

// File-vs-inline-content resolution (--file/--content) is a CLI-only
// concern (commands/doc.ts) — actions always take already-resolved
// Markdown text, since an MCP caller has no local filesystem context
// to read a --file path from.
export async function createDoc(
  client: Client,
  args: { project: string; title: string; content: string },
) {
  const projectId = await resolveProjectId(client, args.project);
  return client.doc.create.mutate({ projectId, title: args.title, content: args.content });
}

export async function listDocs(client: Client, args: { project: string }) {
  const projectId = await resolveProjectId(client, args.project);
  return client.doc.list.query({ projectId });
}

export async function getDoc(client: Client, args: { id: string }) {
  return client.doc.get.query({ id: args.id });
}

export async function updateDoc(
  client: Client,
  args: { id: string; title?: string; content?: string },
) {
  return client.doc.update.mutate({ id: args.id, title: args.title, content: args.content });
}

export async function deleteDoc(client: Client, args: { id: string }) {
  return client.doc.delete.mutate({ id: args.id });
}
