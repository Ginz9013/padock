"use client";

import { useParams } from "next/navigation";
import { Hash } from "lucide-react";

import { ChatThread } from "@/components/chat/chat-thread";
import { useUserProfiles } from "@/lib/use-user-profiles";
import { useProjectChannels } from "../channels-context";

// A project's own channel detail view (CONTEXT.md §5.1.21) — reuses
// ChatThread as-is (already shared with the Dashboard's org-wide
// /chat/channel/[channelId], §5.1.9), only the header and the read-marker
// trigger differ.
export default function ProjectChannelDetailPage() {
  const { channelId } = useParams<{ id: string; channelId: string }>();
  const profiles = useUserProfiles();
  const { channels, markRead } = useProjectChannels();
  const channel = channels.find((c) => c.id === channelId);

  return (
    <div className="h-full min-h-0 overflow-hidden">
      <ChatThread
        target={{ kind: "channel", channelId }}
        profiles={profiles}
        header={
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <Hash className="size-4 text-muted-foreground" />
            <span className="text-sm font-semibold">{channel?.title ?? channelId}</span>
            {channel && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {channel.isDefault ? "Project channel" : "Issue channel"}
              </span>
            )}
          </div>
        }
        onFocusInput={() => markRead(`channel:${channelId}`)}
      />
    </div>
  );
}
