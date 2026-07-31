"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Task } from "./task-types";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MS_PER_DAY = 86_400_000;

// All date math is done in UTC — dates round-trip as "YYYY-MM-DD" (see
// resolve.ts/z.coerce.date() server-side), and doing this in the viewer's
// local timezone would risk shifting a task's calendar cell by a day.
function toDateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}
function startOfMonthUTC(year: number, month: number) {
  return new Date(Date.UTC(year, month, 1));
}
function addDaysUTC(d: Date, days: number) {
  return new Date(d.getTime() + days * MS_PER_DAY);
}
function addMonthsUTC(d: Date, delta: number) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + delta, 1));
}

// A task is placed on `endDate` (its deadline) if set, else `startDate` —
// matching Plane's own calendar layout, which only shows issues that have
// a due date at all. Dragging a card to another day moves whichever of
// those two fields it was placed by.
export function TaskCalendar({
  tasks,
  onChangeDate,
  onOpenTask,
}: {
  tasks: Task[];
  onChangeDate: (taskId: string, field: "startDate" | "endDate", dateKey: string) => void | Promise<void>;
  onOpenTask: (taskId: string) => void;
}) {
  const today = new Date();
  const [month, setMonth] = useState(() => startOfMonthUTC(today.getUTCFullYear(), today.getUTCMonth()));
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const first = startOfMonthUTC(month.getUTCFullYear(), month.getUTCMonth());
  const gridStart = addDaysUTC(first, -first.getUTCDay());
  const days = Array.from({ length: 42 }, (_, i) => addDaysUTC(gridStart, i));
  const todayKey = toDateKey(today);

  const tasksByDate = new Map<string, Task[]>();
  for (const task of tasks) {
    const raw = task.endDate ?? task.startDate;
    if (!raw) continue;
    const key = toDateKey(new Date(raw));
    tasksByDate.set(key, [...(tasksByDate.get(key) ?? []), task]);
  }

  function handleDragEnd(event: DragEndEvent) {
    const taskId = String(event.active.id);
    const dateKey = event.over ? String(event.over.id) : undefined;
    if (!dateKey) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const currentKey = task.endDate
      ? toDateKey(new Date(task.endDate))
      : task.startDate
        ? toDateKey(new Date(task.startDate))
        : undefined;
    if (currentKey === dateKey) return;
    void onChangeDate(taskId, task.endDate ? "endDate" : "startDate", dateKey);
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex shrink-0 items-center justify-between px-1">
        <p className="text-sm font-medium">
          {month.toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" })}
        </p>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="size-7" onClick={() => setMonth((m) => addMonthsUTC(m, -1))}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={() => setMonth(startOfMonthUTC(today.getUTCFullYear(), today.getUTCMonth()))}
          >
            Today
          </Button>
          <Button variant="ghost" size="icon" className="size-7" onClick={() => setMonth((m) => addMonthsUTC(m, 1))}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div
          className="grid min-h-0 flex-1 grid-cols-7 gap-px overflow-auto rounded-md border bg-border"
          style={{ gridTemplateRows: "auto repeat(6, 1fr)" }}
        >
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="bg-background px-2 py-1 text-center text-xs text-muted-foreground">
              {label}
            </div>
          ))}
          {days.map((date) => {
            const key = toDateKey(date);
            return (
              <DayCell
                key={key}
                date={date}
                dateKey={key}
                inMonth={date.getUTCMonth() === month.getUTCMonth()}
                isToday={key === todayKey}
                tasks={tasksByDate.get(key) ?? []}
                onOpenTask={onOpenTask}
              />
            );
          })}
        </div>
      </DndContext>
    </div>
  );
}

function DayCell({
  date,
  dateKey,
  inMonth,
  isToday,
  tasks,
  onOpenTask,
}: {
  date: Date;
  dateKey: string;
  inMonth: boolean;
  isToday: boolean;
  tasks: Task[];
  onOpenTask: (taskId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dateKey });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-0 flex-col gap-1 overflow-y-auto bg-background p-1 transition-colors",
        !inMonth && "text-muted-foreground/50",
        isOver && "bg-muted",
      )}
    >
      <span
        className={cn(
          "text-xs",
          isToday && "flex size-5 items-center justify-center rounded-full bg-primary font-medium text-primary-foreground",
        )}
      >
        {date.getUTCDate()}
      </span>
      {tasks.map((task) => (
        <CalendarCard key={task.id} task={task} onOpenTask={onOpenTask} />
      ))}
    </div>
  );
}

function CalendarCard({ task, onOpenTask }: { task: Task; onOpenTask: (taskId: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => onOpenTask(task.id)}
      className={cn(
        "cursor-grab touch-none truncate rounded bg-card px-1.5 py-0.5 text-[11px] shadow-sm active:cursor-grabbing",
        isDragging && "opacity-50",
      )}
    >
      {task.title}
    </div>
  );
}
