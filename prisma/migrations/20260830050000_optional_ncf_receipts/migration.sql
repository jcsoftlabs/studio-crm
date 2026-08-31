-- DropForeignKey
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_sequenceId_fkey";

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "number" SERIAL NOT NULL,
ALTER COLUMN "ncf" DROP NOT NULL,
ALTER COLUMN "ncfType" DROP NOT NULL,
ALTER COLUMN "sequenceId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "StudioSettings" ADD COLUMN     "allowSalesWithoutNcf" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_number_key" ON "Invoice"("number");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "NcfSequence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

