import { Redis } from "ioredis";

const REDIS_URL = process.env["REDIS_URL"] ?? "redis://localhost:6379";
const PADOCK_EVENTS_CHANNEL = "padock:events";

declare global {
  // eslint-disable-next-line no-var
  var __padockRedisPublisher: Redis | undefined;
}

function getPublisher(): Redis {
  return (globalThis.__padockRedisPublisher ??= new Redis(REDIS_URL));
}

// Finally gives apps/realtime's Phase 0 subscriber (padock:events) a
// real payload instead of nothing — CONTEXT.md §5.1's Redis pub/sub
// extraction seam, now actually carrying chat events (Phase 4).
export async function publishEvent(event: Record<string, unknown>): Promise<void> {
  await getPublisher().publish(PADOCK_EVENTS_CHANNEL, JSON.stringify(event));
}
