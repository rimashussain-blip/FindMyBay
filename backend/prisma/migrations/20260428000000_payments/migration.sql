-- Payments table backing the /bookings/:id/pay flow.
-- One booking can have several Payment rows; only one should ever be 'succeeded'.

CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'succeeded', 'failed', 'cancelled');

CREATE TABLE "payments" (
  "id" TEXT NOT NULL,
  "booking_id" TEXT NOT NULL,
  "processor" TEXT NOT NULL,
  "processor_ref" TEXT NOT NULL,
  "external_ref" TEXT,
  "amount_aed" INTEGER NOT NULL,
  "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
  "hosted_page_url" TEXT,
  "failure_reason" TEXT,
  "paid_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payments_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "payments_processor_ref_key" ON "payments"("processor_ref");
CREATE INDEX "payments_booking_id_idx" ON "payments"("booking_id");
