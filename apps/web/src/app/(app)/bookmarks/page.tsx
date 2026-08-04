"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Star } from "lucide-react";

import { trpc } from "@/lib/trpc";
import { useSession } from "@/lib/auth-client";
import { useUserProfiles } from "@/lib/use-user-profiles";
import { Button } from "@/components/ui/button";

type Bookmark = {
  bookmarkedAt: string;
  chatMessageId: string;
  content: string;
  senderId: string;
  recipientId: string | null;
  createdAt: string;
  channelId: string | null;
  channelTitle: string | null;
  projectId: string | null;
};

// One global list, no project-scoped duplicate (CONTEXT.md §5.1.22) —
// same tier as /notifications and /approvals, not /projects/[id]/channels'
// dual-entry-point pattern, since a bookmark list isn't a browsing surface.
// Flat load, no cursor pagination: unlike notification.list (§5.1.19),
// this is a user-curated list expected to stay small, matching
// chat.inbox's own flat "sort and truncate" precedent.
export default function BookmarksPage() {
  const { data: session } = useSession();
  const profiles = useUserProfiles();
  const [items, setItems] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await trpc.bookmark.list.query();
      setItems(rows);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function remove(chatMessageId: string) {
    setItems((prev) => prev.filter((i) => i.chatMessageId !== chatMessageId));
    await trpc.bookmark.remove.mutate({ chatMessageId });
  }

  function hrefFor(item: Bookmark): string {
    if (item.channelId) {
      return item.projectId
        ? `/projects/${item.projectId}/channels/${item.channelId}`
        : `/chat/channel/${item.channelId}`;
    }
    const meId = session?.user?.id;
    const counterpartId = item.senderId === meId ? item.recipientId : item.senderId;
    return `/chat/${counterpartId}`;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Bookmarks</h1>
        <p className="text-sm text-muted-foreground">Messages you&apos;ve starred, across every DM and channel.</p>
      </div>

      {items.length === 0 && !loading ? (
        <p className="text-sm text-muted-foreground">No bookmarks yet.</p>
      ) : (
        <ul className="flex flex-col divide-y rounded-lg border">
          {items.map((item) => {
            const senderName = profiles.get(item.senderId)?.name ?? item.senderId;
            return (
              <li key={item.chatMessageId} className="flex items-start gap-2 px-4 py-3 text-sm hover:bg-muted">
                <Link href={hrefFor(item)} className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-medium">{senderName}</span>
                    {item.channelTitle && (
                      <span className="text-xs text-muted-foreground">in #{item.channelTitle}</span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {new Date(item.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-muted-foreground">{item.content}</p>
                </Link>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => remove(item.chatMessageId)}
                  aria-label="Remove bookmark"
                  className="shrink-0"
                >
                  <Star className="size-3.5 fill-current text-amber-500" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
