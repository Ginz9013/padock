"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { trpc } from "@/lib/trpc";
import { useRealtimeEvent } from "@/lib/use-realtime";
import { describeNotification, notificationHref, type NotificationItem } from "@/lib/notification-display";
import { Button } from "@/components/ui/button";

// Full history behind the header bell's popover (§5.1.19) — same
// cursor-paginated notification.list query, just "load more" instead of
// a fixed first page. Fetch-on-mount + manual state, no data library,
// matching /approvals' own minimal style.
export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFirstPage = useCallback(async () => {
    setLoading(true);
    try {
      setError(null);
      const result = await trpc.notification.list.query({ limit: 30 });
      setItems(result.items as NotificationItem[]);
      setCursor(result.nextCursor);
      setHasMore(!!result.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  async function loadMore() {
    if (!cursor) return;
    setLoading(true);
    try {
      const result = await trpc.notification.list.query({ cursor, limit: 30 });
      setItems((prev) => [...prev, ...(result.items as NotificationItem[])]);
      setCursor(result.nextCursor);
      setHasMore(!!result.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadFirstPage();
  }, [loadFirstPage]);

  // A push while this page is open just re-loads the first page — the
  // list is short-lived, session-scoped browsing, not something that
  // needs to preserve scroll position across a live insert.
  useRealtimeEvent(
    useCallback(
      (event) => {
        if (event.type === "notification.created" || event.type === "notification.read") {
          void loadFirstPage();
        }
      },
      [loadFirstPage],
    ),
  );

  async function markRead(id: string) {
    await trpc.notification.markRead.mutate({ id });
  }

  async function markAllRead() {
    await trpc.notification.markAllRead.mutate();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            Task assignments, project invitations, and direct messages addressed to you.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={markAllRead}>
          Mark all read
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {items.length === 0 && !loading ? (
        <p className="text-sm text-muted-foreground">No notifications yet.</p>
      ) : (
        <ul className="flex flex-col divide-y rounded-lg border">
          {items.map((item) => {
            const href = notificationHref(item);
            const body = (
              <div
                className={`flex flex-col gap-0.5 px-4 py-3 text-sm hover:bg-muted ${!item.isRead ? "bg-accent/50" : ""}`}
              >
                <span>{describeNotification(item)}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(item.createdAt).toLocaleString()}
                </span>
              </div>
            );
            return (
              <li key={item.id} onClick={() => !item.isRead && markRead(item.id)}>
                {href ? <Link href={href}>{body}</Link> : body}
              </li>
            );
          })}
        </ul>
      )}

      {hasMore && (
        <Button variant="outline" size="sm" className="w-fit" disabled={loading} onClick={loadMore}>
          {loading ? "Loading…" : "Load more"}
        </Button>
      )}
    </div>
  );
}
