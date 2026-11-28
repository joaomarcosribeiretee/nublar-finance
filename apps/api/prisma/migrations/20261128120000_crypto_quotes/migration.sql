-- AlterTable
ALTER TABLE "Investment" ADD COLUMN     "autoQuote" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "coinId" TEXT;

-- AlterTable
ALTER TABLE "InvestmentValuation" ADD COLUMN     "auto" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "CryptoQuote" (
    "coinId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "price" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CryptoQuote_pkey" PRIMARY KEY ("coinId","date")
);

-- Only the API reads quotes; without a policy the public Supabase keys see nothing.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
    EXECUTE 'ALTER TABLE "CryptoQuote" ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;
