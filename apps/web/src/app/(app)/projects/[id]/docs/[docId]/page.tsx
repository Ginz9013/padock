"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";

import { trpc, unwrapWrite } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Doc = { id: string; title: string; content: string };

// Plain Markdown editing (no rich block editor yet — CONTEXT.md
// §5.1.7/§5.1.11: the API already round-trips Markdown<->blocks, this
// page just needs a textarea, not a WYSIWYG editor to reach v1).
export default function DocDetailPage() {
  const { id: projectId, docId } = useParams<{ id: string; docId: string }>();
  const [doc, setDoc] = useState<Doc | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    trpc.doc.get.query({ id: docId }).then((d) => {
      setDoc(d);
      setTitle(d.title);
      setContent(d.content);
    });
  }, [docId]);

  async function save() {
    setSaving(true);
    try {
      const updated = unwrapWrite(await trpc.doc.update.mutate({ id: docId, title, content }));
      setDoc(updated);
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }

  if (!doc) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <Link
        href={`/projects/${projectId}/docs`}
        className="flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3" />
        Docs
      </Link>
      <Input
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          setDirty(true);
        }}
        className="font-heading text-lg font-semibold"
      />
      <Textarea
        value={content}
        onChange={(e) => {
          setContent(e.target.value);
          setDirty(true);
        }}
        className="min-h-[60vh] font-mono text-sm"
        placeholder="Write Markdown…"
      />
      <div className="flex items-center gap-2">
        <Button onClick={save} disabled={saving || !dirty} size="sm">
          {saving ? "Saving…" : "Save"}
        </Button>
        {!dirty && <span className="text-xs text-muted-foreground">Saved</span>}
      </div>
    </div>
  );
}
