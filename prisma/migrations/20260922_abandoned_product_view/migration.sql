-- Additive: PDP views per FCM device + abandoned-view push log.
-- Does not alter Order, Payment, Notification, auth cookies, or DeviceFcmToken columns.
-- Depends on DeviceFcmToken / PushDispatchStatus from 20260921_push_fcm_campaigns.

CREATE TABLE "ProductViewEvent" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "userId" TEXT,
    "lastViewedAt" TIMESTAMP(3) NOT NULL,
    "handledViewAt" TIMESTAMP(3),
    "deferUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductViewEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductViewEvent_deviceId_productId_key" ON "ProductViewEvent"("deviceId", "productId");
CREATE INDEX "ProductViewEvent_lastViewedAt_idx" ON "ProductViewEvent"("lastViewedAt");
CREATE INDEX "ProductViewEvent_deferUntil_lastViewedAt_idx" ON "ProductViewEvent"("deferUntil", "lastViewedAt");
CREATE INDEX "ProductViewEvent_userId_productId_idx" ON "ProductViewEvent"("userId", "productId");

ALTER TABLE "ProductViewEvent" ADD CONSTRAINT "ProductViewEvent_deviceId_fkey"
  FOREIGN KEY ("deviceId") REFERENCES "DeviceFcmToken"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductViewEvent" ADD CONSTRAINT "ProductViewEvent_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductViewEvent" ADD CONSTRAINT "ProductViewEvent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "AbandonedViewPush" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "userId" TEXT,
    "status" "PushDispatchStatus" NOT NULL,
    "error" TEXT,
    "fcmMessageId" TEXT,
    "tokenFingerprint" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AbandonedViewPush_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AbandonedViewPush_deviceId_sentAt_idx" ON "AbandonedViewPush"("deviceId", "sentAt");
CREATE INDEX "AbandonedViewPush_deviceId_productId_sentAt_idx" ON "AbandonedViewPush"("deviceId", "productId", "sentAt");

ALTER TABLE "AbandonedViewPush" ADD CONSTRAINT "AbandonedViewPush_deviceId_fkey"
  FOREIGN KEY ("deviceId") REFERENCES "DeviceFcmToken"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AbandonedViewPush" ADD CONSTRAINT "AbandonedViewPush_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
