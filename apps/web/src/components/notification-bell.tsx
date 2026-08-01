"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";

import { trpc } from "@/lib/trpc";
import { useRealtimeEvent } from "@/lib/use-realtime";
import { useUnreadNotificationCount } from "@/lib/use-unread-notification-count";
import { describeNotification, notificationHref, type NotificationItem } from "@/lib/notification-display";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Persistent top header, not AppSidebar (§5.1.19's UX decision) — the
// header is never collapsed to zero width, so the bell (and its unread
// badge) stays visible from every page regardless of sidebar state.
export function NotificationBell() {
  const { count } = useUnreadNotificationCount();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);

  const loadFirstPage = useCallback(async () => {
    setLoading(true);
    try {
      const result = await trpc.notification.list.query({ limit: 10 });
      setItems(result.items as NotificationItem[]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Refetches the open popover's list too, not just the count, so a
  // notification arriving while the popover is already open shows up
  // without the user having to close/reopen it.
  useRealtimeEvent(
    useCallback(
      (event) => {
        if (open && (event.type === "notification.created" || event.type === "notification.read")) {
          void loadFirstPage();
        }
      },
      [open, loadFirstPage],
    ),
  );

  async function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) await loadFirstPage();
  }

  async function markRead(id: string) {
    await trpc.notification.markRead.mutate({ id });
    // No local setState here — the mutation's own publishEvent (§5.1.19)
    // round-trips back through the same WS listener above and refreshes
    // both the badge and this list from one code path.
  }

  async function markAllRead() {
    await trpc.notification.markAllRead.mutate();
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Notifications" className="relative">
          <Bell className="size-4" />
          {count > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-4 min-w-4 justify-center rounded-full px-1 text-[10px]"
            >
              {count > 99 ? "99+" : count}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-medium">Notifications</span>
          {count > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Mark all read
            </button>
          )}
        </div>

        <div className="max-h-96 overflow-y-auto">
          {loading && items.length === 0 && (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">Loading…</p>
          )}
          {!loading && items.length === 0 && (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">No notifications yet.</p>
          )}
          {items.map((item) => {
            const href = notificationHref(item);
            const content = (
              <div
                className={`flex flex-col gap-0.5 px-3 py-2 text-sm hover:bg-muted ${!item.isRead ? "bg-accent/50" : ""}`}
              >
                <span>{describeNotification(item)}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(item.createdAt).toLocaleString()}
                </span>
              </div>
            );
            return (
              <div key={item.id} onClick={() => !item.isRead && markRead(item.id)}>
                {href ? (
                  <Link href={href} onClick={() => setOpen(false)}>
                    {content}
                  </Link>
                ) : (
                  content
                )}
              </div>
            );
          })}
        </div>

        <div className="border-t px-3 py-2 text-center">
          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            View all
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
