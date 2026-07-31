"use client";

import { useCallback, useState } from "react";

const STORAGE_KEY = "padock:expandedProjects";

function loadExpanded(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<
      string,
      boolean
    >;
  } catch {
    return {};
  }
}

// Same client-side-only approach as use-pinned-projects — no per-user
// field on the backend for this. A project with no explicit entry here
// falls back to whatever the caller passes as `fallback` (the sidebar
// uses "is this project on the current route" so the active project
// opens automatically without needing a stored preference yet).
export function useExpandedProjects() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => loadExpanded());

  const isExpanded = useCallback(
    (id: string, fallback: boolean) => expanded[id] ?? fallback,
    [expanded],
  );

  const toggleExpanded = useCallback((id: string, fallback: boolean) => {
    setExpanded((prev) => {
      const current = prev[id] ?? fallback;
      const next = { ...prev, [id]: !current };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { isExpanded, toggleExpanded };
}
