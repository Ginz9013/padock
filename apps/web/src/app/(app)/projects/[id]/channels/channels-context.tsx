"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

import { trpc } from "@/lib/trpc";
import { useUnread } from "@/lib/use-unread";
import { useRealtimeEvent } from "@/lib/use-realtime";
import type { RealtimeEvent } from "@/lib/realtime";

export type ProjectChannel = {
  id: string;
  title: string;
  projectId: string | null;
  isDefault: boolean;
  createdAt: string;
};

type ProjectChannelsValue = {
  channels: ProjectChannel[];
  defaultChannel: ProjectChannel | null;
  issueChannels: ProjectChannel[];
  loading: boolean;
  refresh: () => Promise<void>;
  // Shared client-only unread tracking (§5.1.9's precedent, no server
  // read-state, CONTEXT.md §5.1.3) — one instance here, not one per
  // component, so the sidebar's dots and the detail page's markRead
  // (fired on compose-box focus, same signal /chat/channel/[channelId]
  // uses — not on sidebar click, which wouldn't mean "noticed") stay in
  // sync.
  isUnread: (key: string) => boolean;
  markRead: (key: string) => void;
};

const ProjectChannelsContext = createContext<ProjectChannelsValue | null>(null);

export function useProjectChannels(): ProjectChannelsValue {
  const ctx = useContext(ProjectChannelsContext);
  if (!ctx) throw new Error("useProjectChannels must be used within ProjectChannelsProvider");
  return ctx;
}

// One shared `channel.list` fetch for the whole /channels route group
// (CONTEXT.md §5.1.21) — the index page's default-channel redirect, the
// sidebar's grouped rendering, and the detail page's header all need the
// same project-scoped channel list, so it's fetched once here instead of
// three times independently.
export function ProjectChannelsProvider({
  projectId,
  children,
}: {
  projectId: string;
  children: ReactNode;
}) {
  const [channels, setChannels] = useState<ProjectChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const { noteLatest, markRead, isUnread } = useUnread();

  const refresh = useCallback(async () => {
    const rows = (await trpc.channel.list.query({ projectId })) as ProjectChannel[];
    setChannels(rows);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  useRealtimeEvent(
    useCallback(
      (event: RealtimeEvent) => {
        if (event.type !== "chat.message") return;
        const message = event.payload.message as { channelId: string | null; createdAt: string };
        if (!message.channelId) return;
        noteLatest(`channel:${message.channelId}`, message.createdAt);
      },
      [noteLatest],
    ),
  );

  const defaultChannel = channels.find((c) => c.isDefault) ?? null;
  // Newest-first, matching channel.list's own `orderBy: createdAt desc` —
  // the default channel is pinned separately in the sidebar (§5.1.21),
  // not sorted alongside these.
  const issueChannels = channels.filter((c) => !c.isDefault);

  return (
    <ProjectChannelsContext.Provider
      value={{ channels, defaultChannel, issueChannels, loading, refresh, isUnread, markRead }}
    >
      {children}
    </ProjectChannelsContext.Provider>
  );
}
