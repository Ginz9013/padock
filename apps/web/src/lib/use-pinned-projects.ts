"use client";

import { useCallback, useState } from "react";

const STORAGE_KEY = "padock:pinnedProjects";

function loadPinned(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

// Client-side only, same approach as use-unread's lastRead tracking —
// there's no pinned-project field on the backend Project model, and a
// per-browser pin list is all the left sidebar's "Pinned" section needs.
export function usePinnedProjects() {
  const [pinned, setPinned] = useState<string[]>(() => loadPinned());

  const isPinned = useCallback((id: string) => pinned.includes(id), [pinned]);

  const togglePin = useCallback((id: string) => {
    setPinned((prev) => {
      const next = prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id];
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { isPinned, togglePin };
}
