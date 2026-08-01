-- CreateEnum
CREATE TYPE "MentionTargetType" AS ENUM ('user', 'task', 'doc');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'chat_mention';

-- CreateTable
CREATE TABLE "chat_mention" (
    "id" TEXT NOT NULL,
    "chatMessageId" TEXT NOT NULL,
    "targetType" "MentionTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_mention_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chat_mention_chatMessageId_idx" ON "chat_mention"("chatMessageId");

-- CreateIndex
CREATE INDEX "chat_mention_targetType_targetId_idx" ON "chat_mention"("targetType", "targetId");

-- AddForeignKey
ALTER TABLE "chat_mention" ADD CONSTRAINT "chat_mention_chatMessageId_fkey" FOREIGN KEY ("chatMessageId") REFERENCES "chat_message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
