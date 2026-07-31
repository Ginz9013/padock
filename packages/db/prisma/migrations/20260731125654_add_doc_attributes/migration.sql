-- CreateEnum
CREATE TYPE "DocAttributeType" AS ENUM ('text', 'number', 'select', 'date', 'checkbox');

-- CreateTable
CREATE TABLE "doc_attribute_definition" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "DocAttributeType" NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "doc_attribute_definition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doc_attribute_option" (
    "id" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "doc_attribute_option_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doc_attribute_value" (
    "id" TEXT NOT NULL,
    "docId" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "valueText" TEXT,
    "valueNumber" DOUBLE PRECISION,
    "valueDate" TIMESTAMP(3),
    "valueBoolean" BOOLEAN,
    "selectOptionId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doc_attribute_value_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "doc_attribute_definition_projectId_idx" ON "doc_attribute_definition"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "doc_attribute_definition_projectId_name_key" ON "doc_attribute_definition"("projectId", "name");

-- CreateIndex
CREATE INDEX "doc_attribute_option_definitionId_idx" ON "doc_attribute_option"("definitionId");

-- CreateIndex
CREATE INDEX "doc_attribute_value_docId_idx" ON "doc_attribute_value"("docId");

-- CreateIndex
CREATE INDEX "doc_attribute_value_definitionId_idx" ON "doc_attribute_value"("definitionId");

-- CreateIndex
CREATE UNIQUE INDEX "doc_attribute_value_docId_definitionId_key" ON "doc_attribute_value"("docId", "definitionId");

-- AddForeignKey
ALTER TABLE "doc_attribute_definition" ADD CONSTRAINT "doc_attribute_definition_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doc_attribute_option" ADD CONSTRAINT "doc_attribute_option_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "doc_attribute_definition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doc_attribute_value" ADD CONSTRAINT "doc_attribute_value_docId_fkey" FOREIGN KEY ("docId") REFERENCES "doc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doc_attribute_value" ADD CONSTRAINT "doc_attribute_value_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "doc_attribute_definition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doc_attribute_value" ADD CONSTRAINT "doc_attribute_value_selectOptionId_fkey" FOREIGN KEY ("selectOptionId") REFERENCES "doc_attribute_option"("id") ON DELETE CASCADE ON UPDATE CASCADE;
