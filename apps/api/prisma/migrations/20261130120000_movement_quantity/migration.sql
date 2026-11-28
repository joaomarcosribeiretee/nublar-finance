-- AlterTable
-- Crypto contributions and redemptions record how many coins moved, so the
-- average price and the realized result can be computed (issue #13).
ALTER TABLE "Transaction" ADD COLUMN     "quantity" TEXT;
