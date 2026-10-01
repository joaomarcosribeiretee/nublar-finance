-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "institutionId" UUID,
ALTER COLUMN "name" SET DEFAULT '';
-- AlterTable
ALTER TABLE "CreditCard" ADD COLUMN     "institutionId" UUID;
-- CreateTable
CREATE TABLE "Institution" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Institution_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "Institution_userId_idx" ON "Institution"("userId");
-- CreateIndex
CREATE UNIQUE INDEX "Institution_userId_name_key" ON "Institution"("userId", "name");
-- AddForeignKey
ALTER TABLE "Institution" ADD CONSTRAINT "Institution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "CreditCard" ADD CONSTRAINT "CreditCard_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: every existing non-cash account and card becomes part of an
-- institution named after it, and the account keeps no nickname so it
-- reads as "<institution> · <type>".
INSERT INTO "Institution" ("id", "userId", "name", "color", "updatedAt")
SELECT gen_random_uuid(), "userId", "name", '#8a9a90', CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT "userId", "name" FROM "Account" WHERE "type" <> 'CASH'
  UNION
  SELECT DISTINCT "userId", "name" FROM "CreditCard"
) AS existing
ON CONFLICT ("userId", "name") DO NOTHING;

UPDATE "Account" AS a
SET "institutionId" = i."id", "name" = ''
FROM "Institution" AS i
WHERE a."type" <> 'CASH' AND i."userId" = a."userId" AND i."name" = a."name";

UPDATE "CreditCard" AS c
SET "institutionId" = i."id"
FROM "Institution" AS i
WHERE i."userId" = c."userId" AND i."name" = c."name";

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
    EXECUTE 'ALTER TABLE "Institution" ENABLE ROW LEVEL SECURITY';
    EXECUTE 'CREATE POLICY "Institution_own" ON "Institution" FOR ALL TO authenticated USING ("userId" = auth.uid()) WITH CHECK ("userId" = auth.uid())';
  END IF;
END $$;
