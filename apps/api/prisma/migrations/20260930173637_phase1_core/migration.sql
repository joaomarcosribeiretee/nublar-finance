-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('CHECKING', 'SAVINGS', 'CASH', 'BROKERAGE', 'CRYPTO', 'OTHER');

-- CreateEnum
CREATE TYPE "CategoryKind" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('INCOME', 'EXPENSE', 'TRANSFER', 'INVESTMENT');

-- CreateEnum
CREATE TYPE "TransactionSource" AS ENUM ('MANUAL', 'CSV_IMPORT', 'OFX_IMPORT', 'OPEN_FINANCE');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'POSTED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "CategoryKind" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "destinationAccountId" UUID,
    "categoryId" UUID,
    "type" "TransactionType" NOT NULL,
    "amount" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "description" TEXT NOT NULL DEFAULT '',
    "date" DATE NOT NULL,
    "source" "TransactionSource" NOT NULL DEFAULT 'MANUAL',
    "status" "TransactionStatus" NOT NULL DEFAULT 'POSTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE INDEX "Category_userId_idx" ON "Category"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_userId_kind_name_key" ON "Category"("userId", "kind", "name");

-- CreateIndex
CREATE INDEX "Transaction_userId_date_idx" ON "Transaction"("userId", "date");

-- CreateIndex
CREATE INDEX "Transaction_accountId_idx" ON "Transaction"("accountId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_destinationAccountId_fkey" FOREIGN KEY ("destinationAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- The API uses the database role and enforces ownership itself.
-- These policies stop the public Supabase keys from reading financial rows.
-- Prisma's shadow database has no auth schema, so this only runs on Supabase.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
    EXECUTE 'ALTER TABLE "User" ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE "Account" ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE "Category" ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE "Transaction" ENABLE ROW LEVEL SECURITY';
    EXECUTE 'CREATE POLICY "User_select_own" ON "User" FOR SELECT TO authenticated USING (id = auth.uid())';
    EXECUTE 'CREATE POLICY "Account_own" ON "Account" FOR ALL TO authenticated USING ("userId" = auth.uid()) WITH CHECK ("userId" = auth.uid())';
    EXECUTE 'CREATE POLICY "Category_own" ON "Category" FOR ALL TO authenticated USING ("userId" = auth.uid()) WITH CHECK ("userId" = auth.uid())';
    EXECUTE 'CREATE POLICY "Transaction_own" ON "Transaction" FOR ALL TO authenticated USING ("userId" = auth.uid()) WITH CHECK ("userId" = auth.uid())';
  END IF;
END $$;
