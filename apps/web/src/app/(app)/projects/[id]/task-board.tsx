"use client";

import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";

import { Badge } from "@/components/ui/badge";

type TaskState = { id: string; name: string; group: string; position: number; isDefault: boolean };
type Task = { id: string; title: string; description: string | null; stateId: string };

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
      <div className="flex gap-4 overflow-x-auto pb-2">
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
      className={`flex w-64 shrink-0 flex-col gap-2 rounded-md border p-2 transition-colors ${
        isOver ? "border-primary bg-muted" : ""
      }`}
    >
      <div className="flex items-center gap-2 px-1">
        <h3 className="text-sm font-medium">{state.name}</h3>
        <Badge variant="secondary">{tasks.length}</Badge>
      </div>
      <div className="flex flex-col gap-1.5">
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
