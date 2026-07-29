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

// No per-channel/per-DM subscription filtering in v1 (§6/§7's "no
// granular permissions yet" stance, extended to the push layer in
// Phase 4): every connected, authenticated client gets every event.
// A client's actual *read* scope is enforced at the query layer
// (chat.history/conversation/search), not here — this is just a
// "something changed, go re-fetch" signal.
const connections = new Set<WebSocket>();

httpServer.on("upgrade", (req, socket, head) => {
  void (async () => {
    const headers = headersFromUpgradeRequest(req.headers);
    const user = await resolveIdentity(headers);
    if (!user) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      console.log(`[realtime] connected: user=${user.id}`);
      connections.add(ws);
      ws.on("close", () => {
        connections.delete(ws);
        console.log(`[realtime] disconnected: user=${user.id}`);
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

redis.on("message", (channel, message) => {
  console.log(`[realtime] redis message on ${channel}:`, message);
  for (const ws of connections) {
    if (ws.readyState === ws.OPEN) {
      ws.send(message);
    }
  }
});

httpServer.listen(PORT, () => {
  console.log(`[realtime] listening on :${PORT}`);
});
