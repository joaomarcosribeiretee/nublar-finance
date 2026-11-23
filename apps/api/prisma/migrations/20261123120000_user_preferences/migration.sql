-- CreateEnum
CREATE TYPE "ThemePreference" AS ENUM ('DARK', 'LIGHT', 'SYSTEM');

-- CreateTable
CREATE TABLE "UserPreferences" (
    "userId" UUID NOT NULL,
    "theme" "ThemePreference" NOT NULL DEFAULT 'DARK',
    "locale" TEXT NOT NULL DEFAULT 'pt-BR',
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "monthStartDay" INTEGER NOT NULL DEFAULT 1,
    "hideValues" BOOLEAN NOT NULL DEFAULT false,
    "onboardingState" JSONB NOT NULL DEFAULT '{"completed":false,"step":null,"skipped":false}',
    "tipsSeen" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreferences_pkey" PRIMARY KEY ("userId"),
    CONSTRAINT "UserPreferences_monthStartDay_check" CHECK ("monthStartDay" BETWEEN 1 AND 28)
);

-- AddForeignKey
ALTER TABLE "UserPreferences" ADD CONSTRAINT "UserPreferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
