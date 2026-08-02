"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { trpc, unwrapWrite } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { ProjectChannel } from "./channels-context";

// Closes a real, separate gap (CONTEXT.md §5.1.21): channel.create has
// been CLI/MCP-only since Phase 4 — the web UI had zero entry point for
// creating an issue channel. Title-only, mirrors Docs/Task's own New
// doc/New task dialogs.
export function NewChannelDialog({
  projectId,
  onCreated,
}: {
  projectId: string;
  onCreated: () => Promise<void>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!title.trim()) return;
    setBusy(true);
    try {
      const channel = unwrapWrite(
        await trpc.channel.create.mutate({ title: title.trim(), projectId }),
      ) as ProjectChannel;
      setTitle("");
      setOpen(false);
      await onCreated();
      router.push(`/projects/${projectId}/channels/${channel.id}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="New channel">
          <Plus className="size-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New channel</DialogTitle>
        </DialogHeader>
        <Input
          placeholder="Channel name"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") void create();
          }}
        />
        <DialogFooter>
          <Button onClick={() => void create()} disabled={busy || !title.trim()}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
