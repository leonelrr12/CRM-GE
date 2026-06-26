-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "budget" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "contact_phone" TEXT,
ADD COLUMN     "receipt_image" TEXT,
ADD COLUMN     "service_interest" TEXT,
ALTER COLUMN "source" SET DEFAULT 'whatsapp';
