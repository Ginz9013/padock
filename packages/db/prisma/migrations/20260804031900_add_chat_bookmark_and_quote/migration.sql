-- AlterTable
ALTER TABLE "chat_message" ADD COLUMN     "quotedMessageId" TEXT;

-- CreateTable
CREATE TABLE "chat_bookmark" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chatMessageId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_bookmark_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chat_bookmark_chatMessageId_idx" ON "chat_bookmark"("chatMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "chat_bookmark_userId_chatMessageId_key" ON "chat_bookmark"("userId", "chatMessageId");

-- CreateIndex
CREATE INDEX "chat_message_quotedMessageId_idx" ON "chat_message"("quotedMessageId");

-- AddForeignKey
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_quotedMessageId_fkey" FOREIGN KEY ("quotedMessageId") REFERENCES "chat_message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_bookmark" ADD CONSTRAINT "chat_bookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_bookmark" ADD CONSTRAINT "chat_bookmark_chatMessageId_fkey" FOREIGN KEY ("chatMessageId") REFERENCES "chat_message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
