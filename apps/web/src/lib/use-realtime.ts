"use client";

import { useEffect } from "react";
import { subscribeRealtime, type RealtimeEvent } from "@/lib/realtime";

// Thin React binding over the realtime singleton (@/lib/realtime).
// Re-subscribing on every render (when `onEvent`'s identity changes)
// is cheap — it's a Set add/remove against an already-open socket,
// not a reconnect — so callers don't need to memoize their handler.
export function useRealtimeEvent(onEvent: (event: RealtimeEvent) => void): void {
  useEffect(() => subscribeRealtime(onEvent), [onEvent]);
}
