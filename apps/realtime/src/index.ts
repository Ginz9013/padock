import { createServer } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { Redis } from "ioredis";
import { resolveIdentity } from "@padock/auth";

const PORT = Number(process.env["REALTIME_PORT"] ?? 3001);
const REDIS_URL = process.env["REDIS_URL"] ?? "redis://localhost:6379";

/**
 * Plain Node process — proves the auth-sharing seam (CONTEXT.md §5.1):
 * this is not a Next.js app, but it authenticates connections with the
 * exact same @padock/auth logic apps/web uses, via a header-based
 * check on the upgrade request rather than a framework request object.
 */
function headersFromUpgradeRequest(rawHeaders: Record<string, string | string[] | undefined>): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(rawHeaders)) {
    if (typeof value === "string") {
      headers.set(key, value);
    } else if (Array.isArray(value)) {
      headers.set(key, value.join(", "));
    }
  }
  return headers;
}

const httpServer = createServer((_req, res) => {
  res.writeHead(200, { "content-type": "text/plain" });
  res.end("padock realtime\n");
});

const wss = new WebSocketServer({ noServer: true });

// Chat keeps its original no-per-channel/per-DM-filtering stance
// (§6/§7, Phase 4): every connected, authenticated client gets every
// chat event, and its actual *read* scope is enforced at the query
// layer (chat.history/conversation/search), not here.
//
// Notifications (§5.1.19, ADR-0002) can't reuse that reasoning — a
// notification's payload is inherently addressed to exactly one User,
// so it's routed to that user's own connections only. `connections`
// still holds every live socket (for broadcast); `connectionsByUser`
// additionally indexes them by identity for targeted delivery — a
// Set per user, not a single socket, since one user can have several
// tabs/devices open at once.
const connections = new Set<WebSocket>();
const connectionsByUser = new Map<string, Set<WebSocket>>();

httpServer.on("upgrade", (req, socket, head) => {
  void (async () => {
    const headers = headersFromUpgradeRequest(req.headers);
    const identity = await resolveIdentity(headers);
    if (!identity) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      const userId = identity.user.id;
      console.log(`[realtime] connected: user=${userId}`);
      connections.add(ws);
      let userSockets = connectionsByUser.get(userId);
      if (!userSockets) {
        userSockets = new Set();
        connectionsByUser.set(userId, userSockets);
      }
      userSockets.add(ws);

      ws.on("close", () => {
        connections.delete(ws);
        userSockets!.delete(ws);
        if (userSockets!.size === 0) {
          connectionsByUser.delete(userId);
        }
        console.log(`[realtime] disconnected: user=${userId}`);
      });
    });
  })();
});

// Redis pub/sub — the extraction seam from CONTEXT.md §5.1. Phase 4
// gives it a real payload: packages/api's chat.send publishes here,
// and every event gets broadcast to all connected sockets below.
const redis = new Redis(REDIS_URL);
const PADOCK_EVENTS_CHANNEL = "padock:events";

redis.subscribe(PADOCK_EVENTS_CHANNEL, (err) => {
  if (err) {
    console.error("[realtime] failed to subscribe to redis", err);
    return;
  }
  console.log(`[realtime] subscribed to ${PADOCK_EVENTS_CHANNEL}`);
});

// Every realtime process instance subscribes to the same channel and
// receives every event, then routes locally against whichever sockets
// it happens to be holding — no cross-instance coordination needed
// even if a user's two tabs land on different instances (§5.1.19).
redis.on("message", (channel, message) => {
  console.log(`[realtime] redis message on ${channel}:`, message);

  let event: { recipientUserIds?: string[] | "broadcast" };
  try {
    event = JSON.parse(message) as typeof event;
  } catch {
    console.error(`[realtime] failed to parse event, dropping`, message);
    return;
  }

  const targets: Iterable<WebSocket> =
    event.recipientUserIds === "broadcast" || event.recipientUserIds === undefined
      ? connections
      : event.recipientUserIds.flatMap((userId) => [...(connectionsByUser.get(userId) ?? [])]);

  for (const ws of targets) {
    if (ws.readyState === ws.OPEN) {
      ws.send(message);
    }
  }
});

httpServer.listen(PORT, () => {
  console.log(`[realtime] listening on :${PORT}`);
});
