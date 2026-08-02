"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

import { useProjectChannels } from "./channels-context";

// Landing state for /projects/[id]/channels (CONTEXT.md §5.1.21):
// redirects to the project's default channel rather than showing an
// empty-state prompt — unlike the Dashboard chat's own landing page
// (/chat), a project is guaranteed exactly one default channel (seeded
// at project creation, §5.1.5's precedent), so there's always something
// to land on.
export default function ProjectChannelsIndexPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const router = useRouter();
  const { defaultChannel, loading } = useProjectChannels();

  useEffect(() => {
    if (defaultChannel) {
      router.replace(`/projects/${projectId}/channels/${defaultChannel.id}`);
    }
  }, [defaultChannel, projectId, router]);

  if (loading || defaultChannel) return null;

  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      This project has no default channel.
    </div>
  );
}
