-- CreateEnum
CREATE TYPE "FixedIncomeProduct" AS ENUM ('CDB', 'LCI', 'LCA', 'TESOURO_SELIC', 'TESOURO_IPCA', 'TESOURO_PREFIXADO', 'DEBENTURE', 'CRI_CRA', 'FUND', 'OTHER');

-- CreateEnum
CREATE TYPE "Indexer" AS ENUM ('CDI', 'IPCA', 'PREFIXED', 'SELIC');

-- CreateEnum
CREATE TYPE "Liquidity" AS ENUM ('DAILY', 'AT_MATURITY');

-- AlterTable
ALTER TABLE "Investment" ADD COLUMN     "indexer" "Indexer",
ADD COLUMN     "liquidity" "Liquidity",
ADD COLUMN     "product" "FixedIncomeProduct",
ADD COLUMN     "rateBps" INTEGER;

