"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Hash } from "lucide-react";

import { cn } from "@/lib/utils";
import { useProjectChannels, type ProjectChannel } from "./channels-context";
import { NewChannelDialog } from "./new-channel-dialog";

// Groups the project's default channel above its issue channels
// (CONTEXT.md §5.1.21) — the default channel is pinned rather than
// sorted alongside the rest, since every project is guaranteed exactly
// one and it's structurally distinct, not just "created earlier."
export function ChannelsSidebar({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const { defaultChannel, issueChannels, refresh, isUnread } = useProjectChannels();

  const base = `/projects/${projectId}/channels/`;
  const activeChannelId = pathname.startsWith(base) ? pathname.slice(base.length).split("/")[0] : null;

  return (
    <div className="flex w-56 shrink-0 flex-col gap-4 overflow-y-auto border-r p-3">
      {defaultChannel && (
        <ChannelLink
          projectId={projectId}
          channel={defaultChannel}
          active={activeChannelId === defaultChannel.id}
          unread={isUnread(`channel:${defaultChannel.id}`)}
        />
      )}

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between pl-2">
          <h3 className="text-xs font-medium text-muted-foreground">Channels</h3>
          <NewChannelDialog projectId={projectId} onCreated={refresh} />
        </div>
        {issueChannels.length === 0 ? (
          <p className="px-2 text-xs text-muted-foreground">No issue channels yet.</p>
        ) : (
          issueChannels.map((channel) => (
            <ChannelLink
              key={channel.id}
              projectId={projectId}
              channel={channel}
              active={activeChannelId === channel.id}
              unread={isUnread(`channel:${channel.id}`)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function ChannelLink({
  projectId,
  channel,
  active,
  unread,
}: {
  projectId: string;
  channel: ProjectChannel;
  active: boolean;
  unread: boolean;
}) {
  return (
    <Link
      href={`/projects/${projectId}/channels/${channel.id}`}
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted",
        active && "bg-muted font-medium",
      )}
    >
      <Hash className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate">{channel.title}</span>
      {unread && <span className="size-2 shrink-0 rounded-full bg-red-500" aria-label="Unread" />}
    </Link>
  );
}
