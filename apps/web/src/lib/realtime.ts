"use client";

// One shared browser-wide connection to apps/realtime's WebSocket
// gateway (CONTEXT.md §5.1's Redis pub/sub extraction seam). Every
// connected client receives every event unfiltered — no per-channel/
// per-DM server-side filtering by design (§5.1.4) — so consumers here
// filter to whatever they individually care about. A module-level
// singleton (not a per-component connection) keeps exactly one socket
// open no matter how many components subscribe.
export type RealtimeEvent = { type: string; [key: string]: unknown };
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
