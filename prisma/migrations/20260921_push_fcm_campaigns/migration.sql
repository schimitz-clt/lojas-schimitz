-- Additive: FCM device tokens + promotional push campaigns.
-- Does not alter Notification (in-app), Order, Payment, Inventory, or auth tables.

CREATE TYPE "PushPlatform" AS ENUM ('android');
CREATE TYPE "PushCampaignAudience" AS ENUM ('all_enabled', 'with_orders');
CREATE TYPE "PushCampaignStatus" AS ENUM ('draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled');
CREATE TYPE "PushDispatchStatus" AS ENUM ('sent', 'failed', 'skipped');

CREATE TABLE "DeviceFcmToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT,
    "platform" "PushPlatform" NOT NULL DEFAULT 'android',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceFcmToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DeviceFcmToken_token_key" ON "DeviceFcmToken"("token");
CREATE INDEX "DeviceFcmToken_userId_idx" ON "DeviceFcmToken"("userId");
CREATE INDEX "DeviceFcmToken_enabled_platform_idx" ON "DeviceFcmToken"("enabled", "platform");
CREATE INDEX "DeviceFcmToken_lastSeenAt_idx" ON "DeviceFcmToken"("lastSeenAt");

ALTER TABLE "DeviceFcmToken" ADD CONSTRAINT "DeviceFcmToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "PushCampaign" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "imageUrl" TEXT,
    "linkPath" TEXT NOT NULL DEFAULT '/',
    "audience" "PushCampaignAudience" NOT NULL DEFAULT 'all_enabled',
    "status" "PushCampaignStatus" NOT NULL DEFAULT 'draft',
    "scheduledAt" TIMESTAMP(3),
    "createdById" TEXT,
    "sentAt" TIMESTAMP(3),
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "errorSummary" TEXT,
    "firebaseReady" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushCampaign_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PushCampaign_status_scheduledAt_idx" ON "PushCampaign"("status", "scheduledAt");
CREATE INDEX "PushCampaign_createdAt_idx" ON "PushCampaign"("createdAt");

ALTER TABLE "PushCampaign" ADD CONSTRAINT "PushCampaign_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "PushDispatch" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "tokenId" TEXT,
    "tokenFingerprint" TEXT NOT NULL,
    "status" "PushDispatchStatus" NOT NULL,
    "error" TEXT,
    "fcmMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushDispatch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PushDispatch_campaignId_createdAt_idx" ON "PushDispatch"("campaignId", "createdAt");
CREATE INDEX "PushDispatch_tokenId_idx" ON "PushDispatch"("tokenId");

ALTER TABLE "PushDispatch" ADD CONSTRAINT "PushDispatch_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "PushCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PushDispatch" ADD CONSTRAINT "PushDispatch_tokenId_fkey"
  FOREIGN KEY ("tokenId") REFERENCES "DeviceFcmToken"("id") ON DELETE SET NULL ON UPDATE CASCADE;
