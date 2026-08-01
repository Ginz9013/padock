"use client";

// One shared browser-wide connection to apps/realtime's WebSocket
// gateway (CONTEXT.md §5.1's Redis pub/sub extraction seam). Chat
// events are still unfiltered broadcast — no per-channel/per-DM
// server-side filtering (§5.1.4) — so chat consumers filter to
// whatever they individually care about. Notification events
// (§5.1.19, ADR-0002) are targeted server-side instead: if a socket
// receives one at all, it's already meant for this user. A
// module-level singleton (not a per-component connection) keeps
// exactly one socket open no matter how many components subscribe.
export type RealtimeEvent = { type: string; payload: Record<string, unknown> };
type Listener = (event: RealtimeEvent) => void;

let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<Listener>();

function realtimeUrl(): string {
  const override = process.env.NEXT_PUBLIC_REALTIME_URL;
  if (override) return override;
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.hostname}:3001`;
}

function connect() {
  if (socket && socket.readyState <= WebSocket.OPEN) return;
  const ws = new WebSocket(realtimeUrl());
  socket = ws;

  ws.onopen = () => {
    // Synthetic, not something the server sends — lets listeners (the
    // notification badge, §5.1.19) refetch on every (re)connect rather
    // than only on mount, since a push missed while disconnected is
    // never resent (the DB row, not the socket, is the source of truth).
    for (const listener of listeners) listener({ type: "__connected__", payload: {} });
  };
  ws.onmessage = (event) => {
    let parsed: RealtimeEvent;
    try {
      parsed = JSON.parse(event.data as string);
    } catch {
      return;
    }
    for (const listener of listeners) listener(parsed);
  };
  ws.onclose = () => {
    if (socket === ws) socket = null;
    if (listeners.size > 0 && reconnectTimer === null) {
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, 2000);
    }
  };
  ws.onerror = () => ws.close();
}

export function subscribeRealtime(listener: Listener): () => void {
  listeners.add(listener);
  connect();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      socket?.close();
      socket = null;
    }
  };
}
