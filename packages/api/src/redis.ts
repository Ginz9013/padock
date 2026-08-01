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

// Envelope generalized in §5.1.19/ADR-0002 to carry an explicit
// routing target: "broadcast" (today's chat behavior, every connected
// socket) or a specific set of recipient userIds (notifications).
// "Who should receive this" is resolved here, in packages/api, where
// the domain/DB access already lives — apps/realtime only routes on
// recipientUserIds, keeping business logic out of the realtime process.
export interface PadockEvent {
  type: string;
  recipientUserIds: string[] | "broadcast";
  payload: Record<string, unknown>;
}

export async function publishEvent(event: PadockEvent): Promise<void> {
  await getPublisher().publish(PADOCK_EVENTS_CHANNEL, JSON.stringify(event));
}
