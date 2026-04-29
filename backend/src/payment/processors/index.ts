// Payment processor abstraction.
//
// Two drivers ship today:
//   - `mock`  → returns a local hosted page that lets us click succeed/fail
//               buttons. Zero third-party setup; the only sane default for
//               dev and CI.
//   - `telr`  → Telr's hosted payment page (UAE-friendly, sandbox is open
//               to anyone). Credentials configured via env.
//
// A future `ni` driver (Network International) plugs in here.

import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { MockPaymentProcessor } from './mock.js';
import { TelrPaymentProcessor } from './telr.js';

export interface CreateIntentInput {
  /** Our internal payment row id — used in webhook path + idempotency. */
  paymentRef: string;
  /** Booking id, surfaces in processor metadata. */
  bookingId: string;
  /** Whole-AED total. */
  amountAed: number;
  /** Customer-facing description on the hosted page. */
  description: string;
  /** Customer email/phone for receipt; optional. */
  customerEmail?: string;
  customerPhone?: string;
  /** Where the processor should redirect on completion. */
  returnUrl: string;
  /** Where the processor should call us back. */
  webhookUrl: string;
}

export interface CreateIntentResult {
  hostedPageUrl: string;
  /** The processor's id for this transaction, if known up front. */
  externalRef?: string;
}

export interface PaymentProcessor {
  /** Driver name — used to populate the `payments.processor` column. */
  readonly name: string;
  createIntent(input: CreateIntentInput): Promise<CreateIntentResult>;
  /**
   * Verify a webhook payload server-side. Used by the router to reject
   * forged webhooks. Returns the canonical { paymentRef, status, externalRef }
   * extracted from the body. Throws on bad signature / unparseable.
   */
  parseWebhook(headers: Record<string, string | string[] | undefined>, rawBody: Buffer | string): {
    paymentRef: string;
    succeeded: boolean;
    externalRef?: string;
    failureReason?: string;
  };
}

let cached: PaymentProcessor | null = null;

export function getPaymentProcessor(): PaymentProcessor {
  if (cached) return cached;
  switch (env.PAYMENT_PROVIDER) {
    case 'telr':
      cached = new TelrPaymentProcessor({
        storeId: env.TELR_STORE_ID,
        authKey: env.TELR_AUTH_KEY,
        testMode: env.TELR_TEST_MODE,
      });
      logger.info({ provider: 'telr', testMode: env.TELR_TEST_MODE }, 'Payment processor initialised');
      return cached;
    case 'mock':
    default:
      cached = new MockPaymentProcessor();
      logger.info({ provider: 'mock' }, 'Payment processor initialised (set PAYMENT_PROVIDER=telr for real)');
      return cached;
  }
}
