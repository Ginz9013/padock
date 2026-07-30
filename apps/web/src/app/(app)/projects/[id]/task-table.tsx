"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PRIORITIES } from "./task-types";
import type { Task, TaskPriority, TaskState } from "./task-types";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
}

// Spreadsheet-style dense view (Plane's Table/Spreadsheet layout is the
// reference) — one row per task, state/priority editable inline like the
// List view already does; assignees/dates are read-only display for now
// (no multi-select or date-picker component built yet).
export function TaskTable({
  states,
  tasks,
  onChangeState,
  onChangePriority,
}: {
  states: TaskState[];
  tasks: Task[];
  onChangeState: (taskId: string, stateId: string) => void | Promise<void>;
  onChangePriority: (taskId: string, priority: TaskPriority) => void | Promise<void>;
}) {
  const stateById = new Map(states.map((s) => [s.id, s]));

  return (
    <div className="h-full min-h-0 overflow-auto rounded-md border">
      <table className="w-full min-w-max border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-background">
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="px-3 py-2 font-medium">Title</th>
            <th className="px-3 py-2 font-medium">State</th>
            <th className="px-3 py-2 font-medium">Priority</th>
            <th className="px-3 py-2 font-medium">Assignees</th>
            <th className="px-3 py-2 font-medium">Start</th>
            <th className="px-3 py-2 font-medium">End</th>
          </tr>
        </thead>
        <tbody>
          {tasks.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-3 py-6 text-center text-xs text-muted-foreground">
                No tasks.
              </td>
            </tr>
          ) : (
            tasks.map((task) => (
              <tr key={task.id} className="border-b last:border-0">
                <td className="max-w-64 truncate px-3 py-2">{task.title}</td>
                <td className="px-3 py-2">
                  <Select value={task.stateId} onValueChange={(v) => onChangeState(task.id, v)}>
                    <SelectTrigger size="sm" className="w-36">
                      <SelectValue>{stateById.get(task.stateId)?.name}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {states.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-3 py-2">
                  <Select
                    value={task.priority}
                    onValueChange={(v) => onChangePriority(task.id, v as TaskPriority)}
                  >
                    <SelectTrigger size="sm" className="w-28">
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
                </td>
                <td className="max-w-48 truncate px-3 py-2 text-muted-foreground">
                  {task.assignees.length === 0
                    ? "—"
                    : task.assignees.map((a) => a.projectMember.user.name).join(", ")}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                  {formatDate(task.startDate)}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                  {formatDate(task.endDate)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
