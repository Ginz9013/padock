"use client";

import { useCallback, useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useRealtimeEvent } from "@/lib/use-realtime";

// The badge count always comes from a fresh DB query (§5.1.19) — never
// derived from a locally-accumulated tally — so it self-corrects
// regardless of how many pushes were missed while disconnected. The
// realtime events below are only *triggers* to refetch, not the data
// itself: mount, every WS (re)connect (__connected__, from
// @/lib/realtime), a new notification arriving, or any read-state
// change (including from this same user's other tabs).
export function useUnreadNotificationCount() {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    setCount(await trpc.notification.unreadCount.query());
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  useRealtimeEvent(
    useCallback(
      (event) => {
        if (
          event.type === "__connected__" ||
          event.type === "notification.created" ||
          event.type === "notification.read"
        ) {
          void refresh();
        }
      },
      [refresh],
    ),
  );

  return { count, refresh };
}
