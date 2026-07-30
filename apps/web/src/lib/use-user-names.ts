"use client";

import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";

// Chat messages only carry a senderId (packages/api/src/router/chat.ts) —
// every chat surface needs this same id->name lookup to render who said what.
export function useUserNames(): Map<string, string> {
  const [names, setNames] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    trpc.user.list.query().then((users) => {
      setNames(new Map(users.map((u) => [u.id, u.name])));
    });
  }, []);

  return names;
}
