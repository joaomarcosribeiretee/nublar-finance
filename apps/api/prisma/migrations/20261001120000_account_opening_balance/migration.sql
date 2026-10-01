-- Money the account already held before the user started tracking it.
-- Counts toward balance and net worth, never toward monthly income.
ALTER TABLE "Account" ADD COLUMN "openingBalance" BIGINT NOT NULL DEFAULT 0;
