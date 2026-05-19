// Mock payment processor.
//
// Returns a local hosted page (served by the payment router) that displays
// "Pay AED 50" + a Succeed / Fail button. No third-party calls. The "webhook"
// it sends is just a JSON POST our own router makes when the user clicks
// succeed/fail — we sign it with the env JWT secret so the verification path
// is exercised end-to-end exactly like a real provider.

import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import type {
  CreateIntentInput,
  CreateIntentResult,
  PaymentProcessor,
  RefundIntentInput,
  RefundIntentResult,
} from './index.js';

export class MockPaymentProcessor implements PaymentProcessor {
  readonly name = 'mock';

  async createIntent(input: CreateIntentInput): Promise<CreateIntentResult> {
    // Hosted page lives inside the API itself, served by the payment router.
    return {
      hostedPageUrl: `${env.PUBLIC_API_BASE_URL}/payments/mock/${input.paymentRef}/page`,
    };
  }

  parseWebhook(headers: Record<string, string | string[] | undefined>, rawBody: Buffer | string): {
    paymentRef: string;
    succeeded: boolean;
    externalRef?: string;
    failureReason?: string;
  } {
    const raw = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody;
    const sig = (headers['x-mock-signature'] ?? headers['X-Mock-Signature']) as string | undefined;
    if (!sig) throw new Error('mock webhook missing X-Mock-Signature header');

    const expected = crypto
      .createHmac('sha256', env.JWT_ACCESS_SECRET)
      .update(raw)
      .digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))) {
      throw new Error('mock webhook signature mismatch');
    }

    const body = JSON.parse(raw) as {
      paymentRef: string;
      status: 'succeeded' | 'failed';
      externalRef?: string;
      failureReason?: string;
    };
    return {
      paymentRef: body.paymentRef,
      succeeded: body.status === 'succeeded',
      externalRef: body.externalRef ?? `mock_${body.paymentRef}`,
      failureReason: body.failureReason,
    };
  }

  async refund(input: RefundIntentInput): Promise<RefundIntentResult> {
    // Mock always-succeeds. Returns a synthetic externalRef so the
    // Refund row has something to point at for audit purposes — the
    // real Telr ref would be the gateway's transaction id.
    return {
      refunded: true,
      externalRef: `mock_refund_${input.refundRef}`,
    };
  }
}

/** Sign a mock webhook body — used by the mock hosted page when emulating the processor. */
export function signMockWebhook(rawBody: string): string {
  return crypto.createHmac('sha256', env.JWT_ACCESS_SECRET).update(rawBody).digest('hex');
}
