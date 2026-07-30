import type { createClient } from "../client.ts";
import { resolveProjectId, resolveTaskStateId, resolveUserId } from "../resolve.ts";

type Client = ReturnType<typeof createClient>;

const PRIORITIES = ["urgent", "high", "medium", "low", "none"] as const;
type Priority = (typeof PRIORITIES)[number];

function parsePriority(value: string | undefined): Priority | undefined {
  if (value === undefined) return undefined;
  if (!(PRIORITIES as readonly string[]).includes(value)) {
    throw new Error(`Invalid priority "${value}" — expected one of: ${PRIORITIES.join(", ")}`);
  }
  return value as Priority;
}

async function resolveAssigneeUserIds(client: Client, assignees: string[] | undefined) {
  if (!assignees) return undefined;
  return Promise.all(assignees.map((a) => resolveUserId(client, a)));
}

export async function createTask(
  client: Client,
  args: {
    project: string;
    title: string;
    description?: string;
    priority?: string;
    startDate?: string;
    endDate?: string;
    assignees?: string[];
  },
) {
  const projectId = await resolveProjectId(client, args.project);
  const assigneeUserIds = await resolveAssigneeUserIds(client, args.assignees);
  return client.task.create.mutate({
    projectId,
    title: args.title,
    description: args.description,
    priority: parsePriority(args.priority),
    startDate: args.startDate,
    endDate: args.endDate,
    assigneeUserIds,
  });
}

export async function listTasks(client: Client, args: { project: string }) {
  const projectId = await resolveProjectId(client, args.project);
  return client.task.list.query({ projectId });
}

export async function updateTaskStatus(client: Client, args: { id: string; status: string }) {
  const existing = await client.task.get.query({ id: args.id });
  const stateId = await resolveTaskStateId(client, existing.projectId, args.status);
  return client.task.updateState.mutate({ id: args.id, stateId });
}

export async function updateTaskPriority(client: Client, args: { id: string; priority: string }) {
  const priority = parsePriority(args.priority);
  if (!priority) throw new Error("--priority is required");
  return client.task.updatePriority.mutate({ id: args.id, priority });
}

// `clearStart`/`clearEnd` win over a same-named value if both are somehow
// given — clearing is the more explicit ask.
export async function updateTaskDates(
  client: Client,
  args: { id: string; startDate?: string; endDate?: string; clearStart?: boolean; clearEnd?: boolean },
) {
  return client.task.updateDates.mutate({
    id: args.id,
    startDate: args.clearStart ? null : args.startDate,
    endDate: args.clearEnd ? null : args.endDate,
  });
}

export async function updateTaskAssignees(client: Client, args: { id: string; assignees: string[] }) {
  const assigneeUserIds = await resolveAssigneeUserIds(client, args.assignees);
  return client.task.updateAssignees.mutate({ id: args.id, assigneeUserIds: assigneeUserIds ?? [] });
}
