"use client";

import { useEffect, useState } from "react";
import { PanelRightClose, PanelRightOpen, Plus } from "lucide-react";

import { trpc } from "@/lib/trpc";
import { useUserProfiles } from "@/lib/use-user-profiles";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChatThread } from "@/components/chat/chat-thread";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Channel = { id: string; title: string; isDefault: boolean };

// The collapsible chat side panel (this session's UX decision,
// CONTEXT.md §5.1.10): orthogonal to the Task/Docs tabs, not a third
// tab — stays open or closed regardless of which one is active.
// Defaults to the project channel; other manually-created "issue
// channels" are reachable from the same panel via a lightweight
// switcher, not a full channel-management UI.
export function ChannelPanel({ projectId }: { projectId: string }) {
  const profiles = useUserProfiles();
  const [open, setOpen] = useState(true);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);

  async function refresh() {
    const rows = await trpc.channel.list.query({ projectId });
    const sorted = [...rows].sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
    setChannels(sorted);
    setActiveChannelId((current) => current ?? sorted[0]?.id ?? null);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  if (!open) {
    return (
      <div className="border-l px-1 py-2">
        <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label="Open chat">
          <PanelRightOpen className="size-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full w-80 shrink-0 flex-col border-l">
      <div className="flex items-center justify-between border-b px-2 py-2">
        <div className="flex items-center gap-1 overflow-x-auto">
          {channels.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveChannelId(c.id)}
              className={cn(
                "shrink-0 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground",
                activeChannelId === c.id && "bg-muted font-medium text-foreground",
              )}
            >
              {c.title}
            </button>
          ))}
          <NewChannelDialog projectId={projectId} onCreated={refresh} />
        </div>
        <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close chat">
          <PanelRightClose className="size-4" />
        </Button>
      </div>
      <div className="min-h-0 flex-1">
        {activeChannelId ? (
          <ChatThread target={{ kind: "channel", channelId: activeChannelId }} profiles={profiles} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No channels yet
          </div>
        )}
      </div>
    </div>
  );
}

function NewChannelDialog({
  projectId,
  onCreated,
}: {
  projectId: string;
  onCreated: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!title.trim()) return;
    setBusy(true);
    try {
      await trpc.channel.create.mutate({ title: title.trim(), projectId });
      setTitle("");
      setOpen(false);
      await onCreated();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="New issue channel"
        >
          <Plus className="size-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New issue channel</DialogTitle>
        </DialogHeader>
        <Input
          placeholder="Channel title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && create()}
          autoFocus
        />
        <DialogFooter>
          <Button onClick={create} disabled={busy || !title.trim()}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
