-- CreateEnum
CREATE TYPE "AssetClass" AS ENUM ('FIXED_INCOME', 'STOCK', 'FII', 'ETF', 'CRYPTO', 'OTHER');

-- AlterEnum
ALTER TYPE "TransactionType" ADD VALUE 'REDEMPTION';

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "investmentId" UUID;

-- CreateTable
CREATE TABLE "Investment" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "institutionId" UUID,
    "name" TEXT NOT NULL,
    "assetClass" "AssetClass" NOT NULL,
    "ticker" TEXT NOT NULL DEFAULT '',
    "quantity" TEXT NOT NULL DEFAULT '',
    "openingApplied" BIGINT NOT NULL DEFAULT 0,
    "startDate" DATE NOT NULL,
    "maturityDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Investment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestmentValuation" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "investmentId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "value" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvestmentValuation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Investment_userId_idx" ON "Investment"("userId");

-- CreateIndex
CREATE INDEX "InvestmentValuation_investmentId_date_idx" ON "InvestmentValuation"("investmentId", "date");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_investmentId_fkey" FOREIGN KEY ("investmentId") REFERENCES "Investment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Investment" ADD CONSTRAINT "Investment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Investment" ADD CONSTRAINT "Investment_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentValuation" ADD CONSTRAINT "InvestmentValuation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentValuation" ADD CONSTRAINT "InvestmentValuation_investmentId_fkey" FOREIGN KEY ("investmentId") REFERENCES "Investment"("id") ON DELETE CASCADE ON UPDATE CASCADE;


DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
    EXECUTE 'ALTER TABLE "Investment" ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE "InvestmentValuation" ENABLE ROW LEVEL SECURITY';
    EXECUTE 'CREATE POLICY "Investment_own" ON "Investment" FOR ALL TO authenticated USING ("userId" = auth.uid()) WITH CHECK ("userId" = auth.uid())';
    EXECUTE 'CREATE POLICY "InvestmentValuation_own" ON "InvestmentValuation" FOR ALL TO authenticated USING ("userId" = auth.uid()) WITH CHECK ("userId" = auth.uid())';
  END IF;
END $$;
