"use client";

import { useEffect, useState } from "react";
import { GripVertical, Plus, X } from "lucide-react";
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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
// admin-only restriction. Reordering is drag-and-drop via @dnd-kit/sortable
// (a new dependency here — the Task Board's own drag, elsewhere in this
// directory, uses raw @dnd-kit/core useDraggable/useDroppable instead,
// since a Kanban column drop target isn't "reorder this list" the way a
// sortable's own purpose-built primitives are).
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

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = definitions.findIndex((d) => d.id === active.id);
    const toIndex = definitions.findIndex((d) => d.id === over.id);
    if (fromIndex === -1 || toIndex === -1) return;
    const reordered = arrayMove(definitions, fromIndex, toIndex);
    setDefinitions(reordered); // optimistic — avoids the row snapping back before refresh() resolves
    setError(null);
    try {
      unwrapWrite(
        await trpc.docAttribute.reorder.mutate({ projectId, orderedIds: reordered.map((d) => d.id) }),
      );
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reorder attributes");
      await refresh();
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
        <DndContext sensors={sensors} onDragEnd={(e) => void handleDragEnd(e)}>
          <SortableContext items={definitions.map((d) => d.id)} strategy={verticalListSortingStrategy}>
            <ul className="flex flex-col gap-1.5">
              {definitions.map((def) => (
                <SortableAttributeRow
                  key={def.id}
                  definition={def}
                  onRename={(name) => renameDefinition(def.id, name)}
                  onDelete={() => deleteDefinition(def.id)}
                  onCreateOption={(name, color) => createOption(def.id, name, color)}
                  onDeleteOption={deleteOption}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

function SortableAttributeRow({
  definition,
  onRename,
  onDelete,
  onCreateOption,
  onDeleteOption,
}: {
  definition: DocAttributeDefinition;
  onRename: (name: string) => void;
  onDelete: () => Promise<void>;
  onCreateOption: (name: string, color: string) => void;
  onDeleteOption: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: definition.id,
  });

  return (
    <li
      ref={setNodeRef}
      // CSS.Transform (not used here) also applies dnd-kit's computed
      // scaleX/scaleY, which stretches/squishes the dragged row to match
      // whatever slot it's currently hovering — rows here are already a
      // fixed height, so only the translate is wanted.
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`rounded-md border bg-card px-3 py-2 ${isDragging ? "z-10 opacity-70" : ""}`}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={`Reorder ${definition.name}`}
          className="shrink-0 cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-3.5" />
        </button>
        <Input
          defaultValue={definition.name}
          onBlur={(e) => {
            const trimmed = e.target.value.trim();
            if (trimmed && trimmed !== definition.name) onRename(trimmed);
          }}
          className="h-7 max-w-48"
        />
        <Badge variant="secondary">{definition.type}</Badge>
        <ConfirmDialog
          trigger={
            <Button size="icon-sm" variant="ghost" className="ml-auto" aria-label={`Delete ${definition.name}`}>
              <X className="size-3.5" />
            </Button>
          }
          title={`Delete "${definition.name}"?`}
          description="Every doc's value for this attribute will be deleted too. This can't be undone."
          onConfirm={onDelete}
        />
      </div>

      {definition.type === "select" && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-5">
          {definition.options.map((opt) => (
            <Badge key={opt.id} variant="secondary" className="gap-1.5 pr-1">
              <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: opt.color }} />
              {opt.name}
              <button
                type="button"
                onClick={() => onDeleteOption(opt.id)}
                aria-label={`Remove ${opt.name}`}
                className="rounded-full hover:bg-muted-foreground/20"
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
          <NewOptionForm onCreate={onCreateOption} />
        </div>
      )}
    </li>
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
