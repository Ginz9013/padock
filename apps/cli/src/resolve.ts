import type { createClient } from "./client.ts";

type Client = ReturnType<typeof createClient>;

// §5.2's own grammar uses `--project=<name>` — nobody should need a
// Prisma cuid to run a command. Match by name first, fall back to
// treating the input as a literal id (so scripts that already have an
// id keep working).
export async function resolveProjectId(client: Client, nameOrId: string): Promise<string> {
  const projects = await client.project.list.query();
  const match = projects.find((p) => p.name.toLowerCase() === nameOrId.toLowerCase());
  return match ? match.id : nameOrId;
}

export async function resolveUserId(client: Client, value: string): Promise<string> {
  const users = await client.user.list.query();
  const match = users.find(
    (u) => u.email.toLowerCase() === value.toLowerCase() || u.name.toLowerCase() === value.toLowerCase(),
  );
  return match ? match.id : value;
}

export async function resolveChannelId(client: Client, nameOrId: string): Promise<string> {
  const channels = await client.channel.list.query();
  const match = channels.find((c) => c.name.toLowerCase() === nameOrId.toLowerCase());
  return match ? match.id : nameOrId;
}

export async function resolveTopicId(client: Client, channelId: string, titleOrId: string): Promise<string> {
  const topics = await client.topic.list.query({ channelId });
  const match = topics.find((t) => t.title.toLowerCase() === titleOrId.toLowerCase());
  return match ? match.id : titleOrId;
}
