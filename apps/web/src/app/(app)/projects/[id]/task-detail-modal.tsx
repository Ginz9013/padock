"use client";

import { useRef, useState } from "react";
import { X } from "lucide-react";
import { TRPCClientError } from "@trpc/client";

import { trpc, unwrapWrite } from "@/lib/trpc";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import MarkdownEditorView, { type MarkdownEditorApi } from "@/components/markdown-editor-view-lazy";
import { AutosaveIndicator, AutosaveStatus, type AutosaveState } from "@/components/autosave-status";
import { PRIORITIES } from "./task-types";
import type { ProjectLabel, ProjectMemberSummary, Task, TaskPriority, TaskState } from "./task-types";
import { LabelBadge } from "./label-badge";

const AUTOSAVE_DELAY_MS = 1500;

// Single place every view (List/Board/Table/Calendar/Timeline) opens to
// edit a task — clicking a task anywhere always opens this instead of
// each view growing its own bespoke editors. Assignees are scoped to the
// task's own project's members (ProjectMember), not every org user, same
// invariant the API enforces server-side.
export function TaskDetailModal({
  task,
  states,
  members,
  labels,
  onClose,
  onChanged,
}: {
  task: Task | null;
  states: TaskState[];
  members: ProjectMemberSummary[];
  labels: ProjectLabel[];
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  return (
    <Sheet open={!!task} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-3xl">
        {task && (
          // Keyed on task.id so switching tasks remounts the form fresh
          // instead of syncing local edit state from props via an effect.
          <TaskDetailForm key={task.id} task={task} states={states} members={members} labels={labels} onChanged={onChanged} />
        )}
      </SheetContent>
    </Sheet>
  );
}

function TaskDetailForm({
  task,
  states,
  members,
  labels,
  onChanged,
}: {
  task: Task;
  states: TaskState[];
  members: ProjectMemberSummary[];
  labels: ProjectLabel[];
  onChanged: () => Promise<void>;
}) {
  const [title, setTitle] = useState(task.title);
  const [status, setStatus] = useState<AutosaveState>("idle");
  const editorApi = useRef<MarkdownEditorApi | null>(null);
  // Shared by every mutation below that touches Task.updatedAt (title/
  // description's own debounced save, plus state/priority/dates) — not
  // just the description autosave — so an in-between state/priority
  // change can never make the description editor's next autosave
  // spuriously conflict against itself (CONTEXT.md §5.1.16).
  const knownUpdatedAt = useRef(task.updatedAt);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Title and description are bundled into one debounced save (same
  // pattern as the Doc editor) rather than title-on-blur + description-
  // on-change as two independent writes, precisely to avoid the above
  // staleness trap between the two fields.
  async function save(force = false) {
    if (!editorApi.current) return;
    setStatus("saving");
    try {
      const description = await editorApi.current.getMarkdown();
      const updated = unwrapWrite(
        await trpc.task.update.mutate({
          id: task.id,
          title: title.trim() || task.title,
          description,
          expectedUpdatedAt: force ? undefined : knownUpdatedAt.current,
        }),
      );
      knownUpdatedAt.current = updated.updatedAt;
      setStatus("saved");
      await onChanged();
    } catch (err) {
      if (err instanceof TRPCClientError && err.data?.code === "CONFLICT") {
        setStatus("conflict");
        return;
      }
      setStatus("idle");
      throw err;
    }
  }

  function scheduleSave() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void save(), AUTOSAVE_DELAY_MS);
  }

  async function reloadLatest() {
    const fresh = await trpc.task.get.query({ id: task.id });
    setTitle(fresh.title);
    knownUpdatedAt.current = fresh.updatedAt;
    await editorApi.current?.replaceMarkdown(fresh.description ?? "");
    setStatus("idle");
    await onChanged();
  }

  async function changeState(stateId: string) {
    const updated = unwrapWrite(await trpc.task.updateState.mutate({ id: task.id, stateId }));
    knownUpdatedAt.current = updated.updatedAt;
    await onChanged();
  }

  async function changePriority(priority: TaskPriority) {
    const updated = unwrapWrite(await trpc.task.updatePriority.mutate({ id: task.id, priority }));
    knownUpdatedAt.current = updated.updatedAt;
    await onChanged();
  }

  async function changeDate(field: "startDate" | "endDate", value: string) {
    const updated = unwrapWrite(await trpc.task.updateDates.mutate({ id: task.id, [field]: value || null }));
    knownUpdatedAt.current = updated.updatedAt;
    await onChanged();
  }

  async function addAssignee(userId: string) {
    const userIds = [...task.assignees.map((a) => a.projectMember.userId), userId];
    await trpc.task.updateAssignees.mutate({ id: task.id, assigneeUserIds: userIds });
    await onChanged();
  }

  async function removeAssignee(userId: string) {
    const userIds = task.assignees.map((a) => a.projectMember.userId).filter((id) => id !== userId);
    await trpc.task.updateAssignees.mutate({ id: task.id, assigneeUserIds: userIds });
    await onChanged();
  }

  async function addLabel(labelId: string) {
    const labelIds = [...task.labels.map((l) => l.labelId), labelId];
    await trpc.task.updateLabels.mutate({ id: task.id, labelIds });
    await onChanged();
  }

  async function removeLabel(labelId: string) {
    const labelIds = task.labels.map((l) => l.labelId).filter((id) => id !== labelId);
    await trpc.task.updateLabels.mutate({ id: task.id, labelIds });
    await onChanged();
  }

  const assignedUserIds = new Set(task.assignees.map((a) => a.projectMember.userId));
  const assignableMembers = members.filter((m) => !assignedUserIds.has(m.userId));

  const assignedLabelIds = new Set(task.labels.map((l) => l.labelId));
  const assignableLabels = labels.filter((l) => !assignedLabelIds.has(l.id));

  return (
    <>
      <SheetHeader>
        <SheetTitle className="sr-only">{task.title || "Task details"}</SheetTitle>
        <div className="flex items-center gap-2">
          <Input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              scheduleSave();
            }}
            className="border-none px-0 text-base font-semibold shadow-none focus-visible:ring-0"
          />
          <AutosaveIndicator status={status} />
        </div>
      </SheetHeader>

      <div className="flex flex-col gap-4 px-4 pb-4">
        <AutosaveStatus status={status} onReloadLatest={() => void reloadLatest()} onForceSave={() => void save(true)} />

        <MarkdownEditorView
          initialContent={task.description ?? ""}
          onChange={scheduleSave}
          onReady={(api) => {
            editorApi.current = api;
          }}
          className="min-h-32"
        />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="mb-1 text-xs text-muted-foreground">State</Label>
            <Select value={task.stateId} onValueChange={changeState}>
              <SelectTrigger size="sm" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {states.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1 text-xs text-muted-foreground">Priority</Label>
            <Select value={task.priority} onValueChange={(v) => changePriority(v as TaskPriority)}>
              <SelectTrigger size="sm" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1 text-xs text-muted-foreground">Start date</Label>
            <Input
              type="date"
              defaultValue={task.startDate?.slice(0, 10) ?? ""}
              onChange={(e) => changeDate("startDate", e.target.value)}
            />
          </div>
          <div>
            <Label className="mb-1 text-xs text-muted-foreground">End date</Label>
            <Input
              type="date"
              defaultValue={task.endDate?.slice(0, 10) ?? ""}
              onChange={(e) => changeDate("endDate", e.target.value)}
            />
          </div>
        </div>

        <div>
          <Label className="mb-1 text-xs text-muted-foreground">Assignees</Label>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {task.assignees.length === 0 && <p className="text-xs text-muted-foreground">Nobody assigned.</p>}
            {task.assignees.map((a) => (
              <Badge key={a.id} variant="secondary" className="gap-1 pr-1">
                {a.projectMember.user.name}
                <button
                  type="button"
                  onClick={() => removeAssignee(a.projectMember.userId)}
                  aria-label={`Remove ${a.projectMember.user.name}`}
                  className="rounded-full hover:bg-muted-foreground/20"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
          {assignableMembers.length > 0 && (
            // Project membership is already a small, curated list (managed
            // on the Overview page) — a plain dropdown is enough here, no
            // need for the search-filter Overview's org-wide add uses.
            <Select value="" onValueChange={addAssignee}>
              <SelectTrigger size="sm" className="w-full">
                <SelectValue placeholder="Assign someone…" />
              </SelectTrigger>
              <SelectContent>
                {assignableMembers.map((m) => (
                  <SelectItem key={m.id} value={m.userId}>
                    {m.user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div>
          <Label className="mb-1 text-xs text-muted-foreground">Labels</Label>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {task.labels.length === 0 && <p className="text-xs text-muted-foreground">No labels.</p>}
            {task.labels.map((l) => (
              <LabelBadge key={l.id} label={l.label} onRemove={() => removeLabel(l.labelId)} />
            ))}
          </div>
          {assignableLabels.length > 0 && (
            // The catalog itself (creating/deleting labels) is managed on the
            // Overview page — here a task can only attach/detach from it.
            <Select value="" onValueChange={addLabel}>
              <SelectTrigger size="sm" className="w-full">
                <SelectValue placeholder="Add a label…" />
              </SelectTrigger>
              <SelectContent>
                {assignableLabels.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>
    </>
  );
}
