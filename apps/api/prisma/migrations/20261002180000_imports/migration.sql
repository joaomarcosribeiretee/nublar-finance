-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "importKey" TEXT;

-- CreateTable
CREATE TABLE "CategoryRule" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "keyword" TEXT NOT NULL,
    "categoryId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategoryRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CategoryRule_userId_keyword_key" ON "CategoryRule"("userId", "keyword");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_accountId_importKey_key" ON "Transaction"("accountId", "importKey");

-- AddForeignKey
ALTER TABLE "CategoryRule" ADD CONSTRAINT "CategoryRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryRule" ADD CONSTRAINT "CategoryRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;


DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
    EXECUTE 'ALTER TABLE "CategoryRule" ENABLE ROW LEVEL SECURITY';
    EXECUTE 'CREATE POLICY "CategoryRule_own" ON "CategoryRule" FOR ALL TO authenticated USING ("userId" = auth.uid()) WITH CHECK ("userId" = auth.uid())';
  END IF;
END $$;
