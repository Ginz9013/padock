"use client";

import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";

export type UserProfile = { name: string; image: string | null };

// Chat messages only carry a senderId (packages/api/src/router/chat.ts) —
// every chat surface needs this same id->profile lookup to render who
// said what, including the avatar shown next to each message.
export function useUserProfiles(): Map<string, UserProfile> {
  const [profiles, setProfiles] = useState<Map<string, UserProfile>>(new Map());

  useEffect(() => {
    trpc.user.list.query().then((users) => {
      setProfiles(new Map(users.map((u) => [u.id, { name: u.name, image: u.image ?? null }])));
    });
  }, []);

  return profiles;
}
