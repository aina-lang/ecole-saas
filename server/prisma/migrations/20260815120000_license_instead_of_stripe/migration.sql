-- DropIndex
DROP INDEX "tenants_stripeCustomerId_key";

-- DropIndex
DROP INDEX "tenants_stripeSubscriptionId_key";

-- AlterTable
ALTER TABLE "tenants" DROP COLUMN "stripeCustomerId",
DROP COLUMN "stripePriceId",
DROP COLUMN "stripeSubscriptionId",
ADD COLUMN     "licenseKey" TEXT;
