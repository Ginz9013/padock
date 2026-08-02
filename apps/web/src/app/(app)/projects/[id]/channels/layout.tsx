"use client";

import { useParams } from "next/navigation";

import { ProjectChannelsProvider } from "./channels-context";
import { ChannelsSidebar } from "./channels-sidebar";

// Sidebar + detail shell for a project's own channels (CONTEXT.md
// §5.1.21) — independent from the Dashboard's org-wide channel/DM feed
// (§5.1.9). The sidebar and whichever of channels/page.tsx (redirect) or
// channels/[channelId]/page.tsx (detail) is active share one
// ProjectChannelsProvider fetch instead of each hitting channel.list
// separately.
export default function ProjectChannelsLayout({ children }: { children: React.ReactNode }) {
  const { id: projectId } = useParams<{ id: string }>();

  return (
    <ProjectChannelsProvider projectId={projectId}>
      <div className="flex h-full min-h-0">
        <ChannelsSidebar projectId={projectId} />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </ProjectChannelsProvider>
  );
}
