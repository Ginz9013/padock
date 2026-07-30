"use client";

import { useCallback, useState } from "react";

const STORAGE_KEY = "padock:lastRead";

function loadLastRead(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

// Client-side only — Padock's chat schema has no read-receipt/unread
// state (CONTEXT.md §5.1.3's deliberate v1 "no unread state" call).
// Compares each conversation's latest known message timestamp
// (fed by realtime events + the initial inbox load) against a
// per-browser "last viewed" timestamp persisted in localStorage.
export function useUnread() {
  const [lastRead, setLastRead] = useState<Record<string, string>>(() => loadLastRead());
  const [latest, setLatest] = useState<Record<string, string>>({});

  const noteLatest = useCallback((key: string, createdAt: string) => {
    const iso = new Date(createdAt).toISOString();
    setLatest((prev) => (!prev[key] || prev[key] < iso ? { ...prev, [key]: iso } : prev));
  }, []);

  const markRead = useCallback((key: string) => {
    setLastRead((prev) => {
      const next = { ...prev, [key]: new Date().toISOString() };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const isUnread = useCallback(
    (key: string) => {
      const latestAt = latest[key];
      return !!latestAt && (!lastRead[key] || lastRead[key] < latestAt);
    },
    [latest, lastRead],
  );

  // `latest` itself is exposed too — the chat sidebar's Recent section
  // sorts people by this same "last known message" timestamp rather
  // than duplicating a second recency tracker.
  return { noteLatest, markRead, isUnread, latest };
}
