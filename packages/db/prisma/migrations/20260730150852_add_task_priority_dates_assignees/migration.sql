-- Adds Task.priority/startDate/endDate and multi-assignee support
-- (TaskAssignee, pointing at ProjectMember rather than User directly —
-- an assignee must already be a member of the task's project). Purely
-- additive: priority defaults to 'none', dates are nullable, and
-- task_assignee starts empty, so no backfill is needed here.

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('urgent', 'high', 'medium', 'low', 'none');

-- AlterTable
ALTER TABLE "task" ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "priority" "TaskPriority" NOT NULL DEFAULT 'none',
ADD COLUMN     "startDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "task_assignee" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "projectMemberId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_assignee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_assignee_taskId_idx" ON "task_assignee"("taskId");

-- CreateIndex
CREATE INDEX "task_assignee_projectMemberId_idx" ON "task_assignee"("projectMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "task_assignee_taskId_projectMemberId_key" ON "task_assignee"("taskId", "projectMemberId");

-- CreateIndex
CREATE INDEX "task_projectId_startDate_idx" ON "task"("projectId", "startDate");

-- CreateIndex
CREATE INDEX "task_projectId_endDate_idx" ON "task"("projectId", "endDate");

-- AddForeignKey
ALTER TABLE "task_assignee" ADD CONSTRAINT "task_assignee_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignee" ADD CONSTRAINT "task_assignee_projectMemberId_fkey" FOREIGN KEY ("projectMemberId") REFERENCES "project_member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
