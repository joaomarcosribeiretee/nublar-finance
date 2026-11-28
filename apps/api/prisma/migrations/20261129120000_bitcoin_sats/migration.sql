-- AlterTable
ALTER TABLE "Investment" ADD COLUMN     "sats" BIGINT;

-- Bitcoin positions move to whole sats (1 BTC = 100.000.000 sats); the
-- typed text is cleared so sats is the only source of the quantity.
UPDATE "Investment"
SET "sats" = round(replace("quantity", ',', '.')::numeric * 100000000)::bigint,
    "quantity" = ''
WHERE "coinId" = 'bitcoin' AND "quantity" ~ '^\d+([.,]\d+)?$';
