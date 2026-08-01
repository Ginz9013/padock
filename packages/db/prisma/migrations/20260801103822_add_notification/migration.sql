-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('task_assigned', 'project_member_added', 'chat_dm');

-- CreateTable
CREATE TABLE "notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "taskId" TEXT,
    "projectId" TEXT,
    "chatMessageId" TEXT,
    "actorId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_userId_createdAt_idx" ON "notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "notification_userId_isRead_idx" ON "notification"("userId", "isRead");

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_chatMessageId_fkey" FOREIGN KEY ("chatMessageId") REFERENCES "chat_message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
