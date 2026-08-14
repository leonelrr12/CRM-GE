-- Add columns as nullable first (backfill before enforcing NOT NULL)
ALTER TABLE "leads" ADD COLUMN     "company_id" TEXT;
ALTER TABLE "users" ADD COLUMN     "company_id" TEXT;

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- Backfill: empresa por defecto para los datos existentes
INSERT INTO companies (id, name, slug, created_at, updated_at)
VALUES ('00000000-0000-4000-8000-000000000001', 'Empresa Principal', 'empresa-principal', now(), now());

UPDATE users SET company_id = '00000000-0000-4000-8000-000000000001' WHERE role = 'user';
UPDATE leads SET company_id = '00000000-0000-4000-8000-000000000001';

-- Now enforce NOT NULL on leads
ALTER TABLE "leads" ALTER COLUMN "company_id" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "companies_slug_key" ON "companies"("slug");

-- CreateIndex
CREATE INDEX "leads_company_id_idx" ON "leads"("company_id");

-- CreateIndex
CREATE INDEX "users_company_id_idx" ON "users"("company_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
