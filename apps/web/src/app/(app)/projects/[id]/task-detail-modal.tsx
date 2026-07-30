"use client";

import { useState } from "react";
import { X } from "lucide-react";

import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PRIORITIES } from "./task-types";
import type { ProjectMemberSummary, Task, TaskPriority, TaskState } from "./task-types";

// Single place every view (List/Board/Table/Calendar/Timeline) opens to
// edit a task — clicking a task anywhere always opens this instead of
// each view growing its own bespoke editors. Assignees are scoped to the
// task's own project's members (ProjectMember), not every org user, same
// invariant the API enforces server-side.
export function TaskDetailModal({
  task,
  states,
  members,
  onClose,
  onChanged,
}: {
  task: Task | null;
  states: TaskState[];
  members: ProjectMemberSummary[];
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  return (
    <Dialog open={!!task} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        {task && (
          // Keyed on task.id so switching tasks remounts the form fresh
          // instead of syncing local edit state from props via an effect.
          <TaskDetailForm key={task.id} task={task} states={states} members={members} onChanged={onChanged} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function TaskDetailForm({
  task,
  states,
  members,
  onChanged,
}: {
  task: Task;
  states: TaskState[];
  members: ProjectMemberSummary[];
  onChanged: () => Promise<void>;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");

  async function saveTitle() {
    const trimmed = title.trim();
    if (trimmed && trimmed !== task.title) {
      await trpc.task.update.mutate({ id: task.id, title: trimmed });
      await onChanged();
    }
  }

  async function saveDescription() {
    if (description !== (task.description ?? "")) {
      await trpc.task.update.mutate({ id: task.id, description });
      await onChanged();
    }
  }

  async function changeState(stateId: string) {
    await trpc.task.updateState.mutate({ id: task.id, stateId });
    await onChanged();
  }

  async function changePriority(priority: TaskPriority) {
    await trpc.task.updatePriority.mutate({ id: task.id, priority });
    await onChanged();
  }

  async function changeDate(field: "startDate" | "endDate", value: string) {
    await trpc.task.updateDates.mutate({ id: task.id, [field]: value || null });
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

  const assignedUserIds = new Set(task.assignees.map((a) => a.projectMember.userId));
  const assignableMembers = members.filter((m) => !assignedUserIds.has(m.userId));

  return (
    <div className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle className="sr-only">{task.title || "Task details"}</DialogTitle>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          className="border-none px-0 text-base font-semibold shadow-none focus-visible:ring-0"
        />
      </DialogHeader>

      <Textarea
        placeholder="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onBlur={saveDescription}
        rows={4}
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
    </div>
  );
}
