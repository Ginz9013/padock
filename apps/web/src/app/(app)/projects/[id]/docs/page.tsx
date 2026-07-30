"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FileText, Plus } from "lucide-react";

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

type Doc = { id: string; title: string; updatedAt: string };

// Flat list for now, nesting is a named future direction, not Phase 8
// scope (CONTEXT.md §5.1.11) — matches Doc's current schema exactly.
export default function ProjectDocsPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const router = useRouter();
  const [docs, setDocs] = useState<Doc[]>([]);

  async function refresh() {
    setDocs(await trpc.doc.list.query({ projectId }));
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [projectId]);

  async function create(title: string) {
    const doc = unwrapWrite(await trpc.doc.create.mutate({ projectId, title, content: "" }));
    router.push(`/projects/${projectId}/docs/${doc.id}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">Docs</h2>
        <NewDocDialog onCreate={create} />
      </div>

      {docs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No docs yet.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {docs.map((doc) => (
            <li key={doc.id}>
              <Link
                href={`/projects/${projectId}/docs/${doc.id}`}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted"
              >
                <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{doc.title}</span>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                  {new Date(doc.updatedAt).toLocaleDateString()}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NewDocDialog({ onCreate }: { onCreate: (title: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!title.trim()) return;
    setBusy(true);
    try {
      await onCreate(title.trim());
    } finally {
      setBusy(false);
      setOpen(false);
      setTitle("");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-3.5" />
          New doc
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New doc</DialogTitle>
        </DialogHeader>
        <Input
          placeholder="Title"
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
