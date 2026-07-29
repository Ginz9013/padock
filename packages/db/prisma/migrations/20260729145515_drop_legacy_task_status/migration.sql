-- DropForeignKey
ALTER TABLE "task" DROP CONSTRAINT "task_stateId_fkey";

-- AlterTable
ALTER TABLE "task" DROP COLUMN "status",
ALTER COLUMN "stateId" SET NOT NULL;

-- DropEnum
DROP TYPE "TaskStatus";

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "task_state"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

