-- CreateTable
CREATE TABLE "Budget" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "amount" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Budget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Goal" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "target" BIGINT NOT NULL,
    "targetDate" DATE,
    "manualSaved" BIGINT NOT NULL DEFAULT 0,
    "color" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoalLink" (
    "id" UUID NOT NULL,
    "goalId" UUID NOT NULL,
    "accountId" UUID,
    "investmentId" UUID,

    CONSTRAINT "GoalLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Budget_categoryId_key" ON "Budget"("categoryId");

-- CreateIndex
CREATE INDEX "Budget_userId_idx" ON "Budget"("userId");

-- CreateIndex
CREATE INDEX "Goal_userId_idx" ON "Goal"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GoalLink_goalId_accountId_key" ON "GoalLink"("goalId", "accountId");

-- CreateIndex
CREATE UNIQUE INDEX "GoalLink_goalId_investmentId_key" ON "GoalLink"("goalId", "investmentId");

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalLink" ADD CONSTRAINT "GoalLink_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalLink" ADD CONSTRAINT "GoalLink_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalLink" ADD CONSTRAINT "GoalLink_investmentId_fkey" FOREIGN KEY ("investmentId") REFERENCES "Investment"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- A link points at exactly one account or one investment.
ALTER TABLE "GoalLink" ADD CONSTRAINT "GoalLink_account_xor_investment" CHECK (("accountId" IS NULL) <> ("investmentId" IS NULL));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
    EXECUTE 'ALTER TABLE "Budget" ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE "Goal" ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE "GoalLink" ENABLE ROW LEVEL SECURITY';
    EXECUTE 'CREATE POLICY "Budget_own" ON "Budget" FOR ALL TO authenticated USING ("userId" = auth.uid()) WITH CHECK ("userId" = auth.uid())';
    EXECUTE 'CREATE POLICY "Goal_own" ON "Goal" FOR ALL TO authenticated USING ("userId" = auth.uid()) WITH CHECK ("userId" = auth.uid())';
    EXECUTE 'CREATE POLICY "GoalLink_own" ON "GoalLink" FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM "Goal" g WHERE g."id" = "goalId" AND g."userId" = auth.uid()))';
  END IF;
END $$;
