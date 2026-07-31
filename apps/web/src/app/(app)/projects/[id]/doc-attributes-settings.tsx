"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";

import { trpc, unwrapWrite } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DOC_ATTRIBUTE_TYPES } from "./doc-attribute-types";
import type { DocAttributeDefinition, DocAttributeType } from "./doc-attribute-types";
import { LABEL_COLORS } from "./task-types";

// Project-scoped custom attribute schema for Docs (CONTEXT.md §5.1.18) —
// same "any project member can edit" access model as Labels above it, no
// admin-only restriction. Reordering is up/down buttons rather than
// drag-and-drop: @dnd-kit/sortable isn't a dependency here (only
// @dnd-kit/core, used for the Task Board's column drag, a different
// interaction), and a short list of attribute definitions doesn't need it.
export function DocAttributesSettings({ projectId }: { projectId: string }) {
  const [definitions, setDefinitions] = useState<DocAttributeDefinition[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      const list = await trpc.docAttribute.list.query({ projectId });
      setDefinitions(list as DocAttributeDefinition[]);
      setLoaded(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load doc attributes");
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [projectId]);

  async function createDefinition(name: string, type: DocAttributeType) {
    setError(null);
    try {
      unwrapWrite(await trpc.docAttribute.create.mutate({ projectId, name, type }));
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create attribute");
    }
  }

  async function renameDefinition(id: string, name: string) {
    setError(null);
    try {
      unwrapWrite(await trpc.docAttribute.rename.mutate({ id, name }));
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rename attribute");
    }
  }

  async function deleteDefinition(id: string) {
    setError(null);
    try {
      await trpc.docAttribute.delete.mutate({ id });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete attribute");
    }
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= definitions.length) return;
    const reordered = [...definitions];
    const a = reordered[index]!;
    const b = reordered[target]!;
    reordered[index] = b;
    reordered[target] = a;
    setError(null);
    try {
      unwrapWrite(
        await trpc.docAttribute.reorder.mutate({ projectId, orderedIds: reordered.map((d) => d.id) }),
      );
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reorder attributes");
    }
  }

  async function createOption(definitionId: string, name: string, color: string) {
    setError(null);
    try {
      unwrapWrite(await trpc.docAttribute.createOption.mutate({ definitionId, name, color }));
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add option");
    }
  }

  async function deleteOption(id: string) {
    setError(null);
    try {
      unwrapWrite(await trpc.docAttribute.deleteOption.mutate({ id }));
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete option");
    }
  }

  if (!loaded) return null;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">Doc attributes</h2>
        <NewAttributeForm onCreate={createDefinition} />
      </div>

      {error && (
        <p className="mb-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}

      {definitions.length === 0 ? (
        <p className="text-xs text-muted-foreground">No custom attributes.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {definitions.map((def, index) => (
            <li key={def.id} className="rounded-md border px-3 py-2">
              <div className="flex items-center gap-2">
                <div className="flex shrink-0 flex-col">
                  <button
                    type="button"
                    aria-label="Move up"
                    disabled={index === 0}
                    onClick={() => void move(index, -1)}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >
                    <ArrowUp className="size-3" />
                  </button>
                  <button
                    type="button"
                    aria-label="Move down"
                    disabled={index === definitions.length - 1}
                    onClick={() => void move(index, 1)}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >
                    <ArrowDown className="size-3" />
                  </button>
                </div>
                <Input
                  defaultValue={def.name}
                  onBlur={(e) => {
                    const trimmed = e.target.value.trim();
                    if (trimmed && trimmed !== def.name) void renameDefinition(def.id, trimmed);
                  }}
                  className="h-7 max-w-48"
                />
                <Badge variant="secondary">{def.type}</Badge>
                <ConfirmDialog
                  trigger={
                    <Button size="icon-sm" variant="ghost" className="ml-auto" aria-label={`Delete ${def.name}`}>
                      <X className="size-3.5" />
                    </Button>
                  }
                  title={`Delete "${def.name}"?`}
                  description="Every doc's value for this attribute will be deleted too. This can't be undone."
                  onConfirm={() => deleteDefinition(def.id)}
                />
              </div>

              {def.type === "select" && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-5">
                  {def.options.map((opt) => (
                    <Badge key={opt.id} variant="secondary" className="gap-1.5 pr-1">
                      <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: opt.color }} />
                      {opt.name}
                      <button
                        type="button"
                        onClick={() => void deleteOption(opt.id)}
                        aria-label={`Remove ${opt.name}`}
                        className="rounded-full hover:bg-muted-foreground/20"
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                  <NewOptionForm onCreate={(name, color) => createOption(def.id, name, color)} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NewAttributeForm({ onCreate }: { onCreate: (name: string, type: DocAttributeType) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<DocAttributeType>("text");

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreate(trimmed, type);
    setName("");
    setType("text");
    setOpen(false);
  }

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Add attribute
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-md border bg-popover p-2 shadow-sm">
      <Input
        placeholder="Attribute name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        autoFocus
        className="h-7 w-36"
      />
      <Select value={type} onValueChange={(v) => setType(v as DocAttributeType)}>
        <SelectTrigger size="sm" className="w-28">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DOC_ATTRIBUTE_TYPES.map((t) => (
            <SelectItem key={t.value} value={t.value}>
              {t.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button size="sm" onClick={submit} disabled={!name.trim()}>
        Add
      </Button>
      <Button size="icon-sm" variant="ghost" onClick={() => setOpen(false)} aria-label="Cancel">
        <X className="size-3.5" />
      </Button>
    </div>
  );
}

function NewOptionForm({ onCreate }: { onCreate: (name: string, color: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(LABEL_COLORS[0]);

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreate(trimmed, color);
    setName("");
    setColor(LABEL_COLORS[0]);
    setOpen(false);
  }

  if (!open) {
    return (
      <Button size="icon-sm" variant="ghost" onClick={() => setOpen(true)} aria-label="Add option">
        <Plus className="size-3.5" />
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1.5 rounded-md border bg-popover p-1.5 shadow-sm">
      <Input
        placeholder="Option name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        autoFocus
        className="h-6 w-28"
      />
      <div className="flex items-center gap-1">
        {LABEL_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            aria-label={`Color ${c}`}
            className={`size-3.5 rounded-full ring-offset-1 ring-offset-background ${color === c ? "ring-2 ring-foreground" : ""}`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
      <Button size="icon-sm" onClick={submit} disabled={!name.trim()} aria-label="Save option">
        <Plus className="size-3.5" />
      </Button>
      <Button size="icon-sm" variant="ghost" onClick={() => setOpen(false)} aria-label="Cancel">
        <X className="size-3.5" />
      </Button>
    </div>
  );
}
