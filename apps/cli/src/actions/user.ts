import type { createClient } from "../client.ts";

type Client = ReturnType<typeof createClient>;

export async function listUsers(client: Client) {
  return client.user.list.query();
}
