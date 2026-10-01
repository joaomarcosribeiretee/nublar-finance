-- AlterTable
ALTER TABLE "RecurringRule" ADD COLUMN     "cardId" UUID,
ADD COLUMN     "installments" INTEGER,
ALTER COLUMN "accountId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "RecurringRule" ADD CONSTRAINT "RecurringRule_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "CreditCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- A rule moves money from exactly one place: an account or a card.
ALTER TABLE "RecurringRule" ADD CONSTRAINT "RecurringRule_account_xor_card" CHECK (("accountId" IS NULL) <> ("cardId" IS NULL));
