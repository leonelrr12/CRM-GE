-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "primary_color" DROP DEFAULT;

-- NULL = sin branding configurado; cada superficie aplica su fallback
-- (formulario #16a34a, shell CRM #2563eb).
UPDATE "companies" SET "primary_color" = NULL;
