"use client";

import { useEffect, useRef } from "react";
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";

import { Badge } from "@/components/ui/badge";
import type { Task, TaskState } from "./task-types";

// Click-and-drag panning for the horizontal scroll area, since the
// scrollbar itself is hidden (visually noisy for something this wide).
// Skips starting a pan when the press lands on a card — those are
// dnd-kit's own draggable, not the board background.
function useDragToScroll<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let panning = false;
    let startX = 0;
    let startScrollLeft = 0;

    function onPointerDown(e: PointerEvent) {
      if ((e.target as HTMLElement).closest("[data-board-card]")) return;
      panning = true;
      startX = e.clientX;
      startScrollLeft = el!.scrollLeft;
      el!.setPointerCapture(e.pointerId);
      el!.style.userSelect = "none";
    }
    function onPointerMove(e: PointerEvent) {
      if (!panning) return;
      el!.scrollLeft = startScrollLeft - (e.clientX - startX);
    }
    function endPan(e: PointerEvent) {
      if (!panning) return;
      panning = false;
      el!.releasePointerCapture(e.pointerId);
      el!.style.userSelect = "";
    }

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", endPan);
    el.addEventListener("pointercancel", endPan);
    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", endPan);
      el.removeEventListener("pointercancel", endPan);
    };
  }, []);

  return ref;
}

// Columns = the project's own TaskStates (§5.1.5), same grouping the List
// view already uses — dragging a card only changes `stateId`, there's no
// persisted ordering within a column (Task has no position field).
export function TaskBoard({
  states,
  tasks,
  onMove,
}: {
  states: TaskState[];
  tasks: Task[];
  onMove: (taskId: string, stateId: string) => void | Promise<void>;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const scrollRef = useDragToScroll<HTMLDivElement>();

  function handleDragEnd(event: DragEndEvent) {
    const taskId = String(event.active.id);
    const stateId = event.over ? String(event.over.id) : undefined;
    if (!stateId) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.stateId === stateId) return;
    void onMove(taskId, stateId);
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div
        ref={scrollRef}
        className="scrollbar-none flex h-full min-h-0 cursor-grab gap-4 overflow-x-auto pb-2 active:cursor-grabbing"
      >
        {states.map((state) => (
          <BoardColumn key={state.id} state={state} tasks={tasks.filter((t) => t.stateId === state.id)} />
        ))}
      </div>
    </DndContext>
  );
}

function BoardColumn({ state, tasks }: { state: TaskState; tasks: Task[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: state.id });

  return (
    <div
      ref={setNodeRef}
      className={`flex h-full w-64 shrink-0 flex-col gap-2 rounded-md border p-2 transition-colors ${
        isOver ? "border-primary bg-muted" : ""
      }`}
    >
      <div className="flex shrink-0 items-center gap-2 px-1">
        <h3 className="text-sm font-medium">{state.name}</h3>
        <Badge variant="secondary">{tasks.length}</Badge>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto">
        {tasks.length === 0 ? (
          <p className="px-1 text-xs text-muted-foreground">No tasks.</p>
        ) : (
          tasks.map((task) => <BoardCard key={task.id} task={task} />)
        )}
      </div>
    </div>
  );
}

function BoardCard({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;

  return (
    <div
      ref={setNodeRef}
      data-board-card
      style={style}
      {...listeners}
      {...attributes}
      className={`cursor-grab touch-none rounded-md border bg-card px-3 py-2 shadow-sm active:cursor-grabbing ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      <p className="truncate text-sm">{task.title}</p>
      {task.description && <p className="truncate text-xs text-muted-foreground">{task.description}</p>}
    </div>
  );
}
