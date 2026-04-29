-- Smart-alert engine tables: alerts (scheduler state) + device_tokens (FCM).

CREATE TYPE "AlertStatus" AS ENUM ('scheduled', 'fired', 'cancelled');

CREATE TABLE "alerts" (
  "id" TEXT NOT NULL,
  "booking_id" TEXT NOT NULL,
  "due_at" TIMESTAMP(3) NOT NULL,
  "eta_min" INTEGER NOT NULL DEFAULT 0,
  "status" "AlertStatus" NOT NULL DEFAULT 'scheduled',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "alerts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "alerts_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE
);
CREATE INDEX "alerts_status_due_at_idx" ON "alerts"("status", "due_at");
CREATE INDEX "alerts_booking_id_idx" ON "alerts"("booking_id");

CREATE TABLE "device_tokens" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "fcm_token" TEXT NOT NULL,
  "platform" TEXT NOT NULL DEFAULT 'android',
  "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "device_tokens_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "device_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "device_tokens_fcm_token_key" ON "device_tokens"("fcm_token");
CREATE INDEX "device_tokens_user_id_idx" ON "device_tokens"("user_id");
