-- AlterEnum
ALTER TYPE "TransactionStatus" ADD VALUE 'CANCELED';

-- AlterEnum
ALTER TYPE "TransactionType" ADD VALUE 'CARD_PAYMENT';

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "cardId" UUID,
ADD COLUMN     "installmentCount" INTEGER,
ADD COLUMN     "installmentNumber" INTEGER,
ADD COLUMN     "invoiceMonth" TEXT,
ADD COLUMN     "occurrence" TEXT,
ADD COLUMN     "purchaseId" UUID,
ADD COLUMN     "recurringRuleId" UUID,
ALTER COLUMN "accountId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "CreditCard" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "limit" BIGINT NOT NULL,
    "closingDay" INTEGER NOT NULL,
    "dueDay" INTEGER NOT NULL,
    "paymentAccountId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardPurchase" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "cardId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "amount" BIGINT NOT NULL,
    "installments" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CardPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringRule" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "TransactionType" NOT NULL,
    "accountId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "amount" BIGINT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "dayOfMonth" INTEGER NOT NULL,
    "startMonth" TEXT NOT NULL,
    "endMonth" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CreditCard_userId_idx" ON "CreditCard"("userId");

-- CreateIndex
CREATE INDEX "CardPurchase_userId_idx" ON "CardPurchase"("userId");

-- CreateIndex
CREATE INDEX "CardPurchase_cardId_idx" ON "CardPurchase"("cardId");

-- CreateIndex
CREATE INDEX "RecurringRule_userId_idx" ON "RecurringRule"("userId");

-- CreateIndex
CREATE INDEX "Transaction_userId_invoiceMonth_idx" ON "Transaction"("userId", "invoiceMonth");

-- CreateIndex
CREATE INDEX "Transaction_cardId_idx" ON "Transaction"("cardId");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_recurringRuleId_occurrence_key" ON "Transaction"("recurringRuleId", "occurrence");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "CreditCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "CardPurchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_recurringRuleId_fkey" FOREIGN KEY ("recurringRuleId") REFERENCES "RecurringRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditCard" ADD CONSTRAINT "CreditCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditCard" ADD CONSTRAINT "CreditCard_paymentAccountId_fkey" FOREIGN KEY ("paymentAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardPurchase" ADD CONSTRAINT "CardPurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardPurchase" ADD CONSTRAINT "CardPurchase_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "CreditCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardPurchase" ADD CONSTRAINT "CardPurchase_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringRule" ADD CONSTRAINT "RecurringRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringRule" ADD CONSTRAINT "RecurringRule_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringRule" ADD CONSTRAINT "RecurringRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Every row moves money somewhere: an account, a card, or both (card payment).
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_account_or_card"
  CHECK ("accountId" IS NOT NULL OR "cardId" IS NOT NULL);

-- Same policy as phase 1: block the public Supabase keys from these rows.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
    EXECUTE 'ALTER TABLE "CreditCard" ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE "CardPurchase" ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE "RecurringRule" ENABLE ROW LEVEL SECURITY';
    EXECUTE 'CREATE POLICY "CreditCard_own" ON "CreditCard" FOR ALL TO authenticated USING ("userId" = auth.uid()) WITH CHECK ("userId" = auth.uid())';
    EXECUTE 'CREATE POLICY "CardPurchase_own" ON "CardPurchase" FOR ALL TO authenticated USING ("userId" = auth.uid()) WITH CHECK ("userId" = auth.uid())';
    EXECUTE 'CREATE POLICY "RecurringRule_own" ON "RecurringRule" FOR ALL TO authenticated USING ("userId" = auth.uid()) WITH CHECK ("userId" = auth.uid())';
  END IF;
END $$;
