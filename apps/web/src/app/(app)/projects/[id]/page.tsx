"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";

import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type TaskState = { id: string; name: string; group: string; position: number; isDefault: boolean };
type Task = { id: string; title: string; description: string | null; stateId: string };

// The project workspace's default view (Plane's work-item list is the
// reference, CONTEXT.md §5's UX shell) — grouped by that project's own
// configurable states (§5.1.5), not a global status enum.
export default function ProjectTaskPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const [states, setStates] = useState<TaskState[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  async function refresh() {
    const [stateList, taskList] = await Promise.all([
      trpc.taskState.list.query({ projectId }),
      trpc.task.list.query({ projectId }),
    ]);
    setStates([...stateList].sort((a, b) => a.position - b.position));
    setTasks(taskList);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [projectId]);

  async function changeState(taskId: string, stateId: string) {
    await trpc.task.updateState.mutate({ id: taskId, stateId });
    await refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">Tasks</h2>
        <NewTaskDialog projectId={projectId} onCreated={refresh} />
      </div>

      <div className="flex flex-col gap-6">
        {states.map((state) => {
          const stateTasks = tasks.filter((t) => t.stateId === state.id);
          return (
            <div key={state.id}>
              <div className="mb-2 flex items-center gap-2">
                <h3 className="text-sm font-medium">{state.name}</h3>
                <Badge variant="secondary">{stateTasks.length}</Badge>
              </div>
              {stateTasks.length === 0 ? (
                <p className="text-xs text-muted-foreground">No tasks.</p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {stateTasks.map((task) => (
                    <li
                      key={task.id}
                      className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm">{task.title}</p>
                        {task.description && (
                          <p className="truncate text-xs text-muted-foreground">
                            {task.description}
                          </p>
                        )}
                      </div>
                      <Select value={task.stateId} onValueChange={(v) => changeState(task.id, v)}>
                        <SelectTrigger size="sm" className="w-36 shrink-0">
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
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NewTaskDialog({
  projectId,
  onCreated,
}: {
  projectId: string;
  onCreated: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!title.trim()) return;
    setBusy(true);
    try {
      await trpc.task.create.mutate({
        projectId,
        title: title.trim(),
        description: description.trim() || undefined,
      });
      setTitle("");
      setDescription("");
      setOpen(false);
      await onCreated();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-3.5" />
          New task
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          <Textarea
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button onClick={create} disabled={busy || !title.trim()}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
