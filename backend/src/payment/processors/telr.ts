// Telr hosted-payment-page driver.
//
// Telr's API: POST application/x-www-form-urlencoded to
//   https://secure.telr.com/gateway/order.json
// with ivp_method=create + ivp_store + ivp_authkey + amount + currency + cart
// + return URLs. Telr responds with { order: { ref, url } } where url is the
// hosted page we hand to the customer. After the customer pays, Telr redirects
// to ivp_returnurl AND POSTs to ivp_framed (we use it as our webhook).
//
// This driver is dormant until PAYMENT_PROVIDER=telr is set and credentials
// are filled in. We verify the webhook by re-querying Telr's
// `order.check` endpoint with our store credentials — Telr does not sign
// webhook payloads, so server-side re-verification is the canonical pattern.

import type {
  CreateIntentInput,
  CreateIntentResult,
  PaymentProcessor,
  RefundIntentInput,
  RefundIntentResult,
} from './index.js';

interface TelrConfig {
  storeId: string;
  authKey: string;
  testMode: boolean;
}

interface TelrCreateResponse {
  order?: { ref: string; url: string };
  error?: { message: string; note?: string };
}

interface TelrCheckResponse {
  order?: {
    ref: string;
    status?: { code: number; text: string };
    transaction?: { ref: string; status: string; message?: string };
  };
  error?: { message: string };
}

export class TelrPaymentProcessor implements PaymentProcessor {
  readonly name = 'telr';

  constructor(private readonly cfg: TelrConfig) {
    if (!cfg.storeId || !cfg.authKey) {
      // We surface this lazily on first use rather than failing boot, so that
      // PAYMENT_PROVIDER=mock dev environments don't need to set Telr creds.
    }
  }

  async createIntent(input: CreateIntentInput): Promise<CreateIntentResult> {
    if (!this.cfg.storeId || !this.cfg.authKey) {
      throw new Error('Telr credentials not configured: set TELR_STORE_ID and TELR_AUTH_KEY');
    }

    const body = new URLSearchParams({
      ivp_method: 'create',
      ivp_store: this.cfg.storeId,
      ivp_authkey: this.cfg.authKey,
      ivp_test: this.cfg.testMode ? '1' : '0',
      ivp_amount: input.amountAed.toFixed(2),
      ivp_currency: 'AED',
      ivp_desc: input.description,
      ivp_cart: input.paymentRef, // surfaces in webhook + check responses
      // Telr redirect targets — note `framed` is what they POST to as a webhook.
      ivp_returnurl: input.returnUrl,
      ivp_returncan: input.returnUrl,
      ivp_returndecl: input.returnUrl,
      ivp_framed: input.webhookUrl,
      ...(input.customerEmail ? { bill_email: input.customerEmail } : {}),
      ...(input.customerPhone ? { bill_phone: input.customerPhone } : {}),
    });

    const res = await fetch('https://secure.telr.com/gateway/order.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const json = (await res.json()) as TelrCreateResponse;
    if (!res.ok || json.error || !json.order) {
      throw new Error(`Telr create failed: ${json.error?.message ?? res.statusText}`);
    }
    return { hostedPageUrl: json.order.url, externalRef: json.order.ref };
  }

  parseWebhook(_headers: Record<string, string | string[] | undefined>, rawBody: Buffer | string): {
    paymentRef: string;
    succeeded: boolean;
    externalRef?: string;
    failureReason?: string;
  } {
    // Telr POSTs urlencoded form data to the framed callback. We extract the
    // cart (= our paymentRef) and the order ref, then call back to Telr to
    // re-verify the status — webhook bodies are NOT signed, so re-querying is
    // the only safe authentication.
    const raw = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody;
    const params = new URLSearchParams(raw);
    const paymentRef = params.get('cart') ?? params.get('ivp_cart') ?? '';
    const orderRef = params.get('order_ref') ?? params.get('tran_ref') ?? '';
    if (!paymentRef || !orderRef) throw new Error('Telr webhook missing cart/order_ref');

    // We can only return synchronously here. The router's confirmPayment path
    // will call verifyOrder() below before trusting the success bit.
    const status = params.get('tran_status') ?? params.get('order_status');
    return {
      paymentRef,
      succeeded: status === 'A' || status === 'paid' || status === '3',
      externalRef: orderRef,
      failureReason: params.get('tran_message') ?? undefined,
    };
  }

  /**
   * Reverse a previously-succeeded charge via Telr's `refund` operation
   * (gateway path: `order.json` with `ivp_method=refund` + `order_ref`).
   * Telr supports partial refunds; we pass the AED amount as-is.
   *
   * Test mode (TELR_TEST_MODE=true) hits the sandbox endpoint where every
   * refund auto-succeeds — gives us a real end-to-end path without
   * needing a live gateway account.
   */
  async refund(input: RefundIntentInput): Promise<RefundIntentResult> {
    if (!this.cfg.storeId || !this.cfg.authKey) {
      throw new Error('Telr credentials not configured: set TELR_STORE_ID and TELR_AUTH_KEY');
    }
    const body = new URLSearchParams({
      ivp_method: 'refund',
      ivp_store: this.cfg.storeId,
      ivp_authkey: this.cfg.authKey,
      ivp_test: this.cfg.testMode ? '1' : '0',
      order_ref: input.externalRef,
      ivp_amount: input.amountAed.toFixed(2),
      ivp_currency: 'AED',
      ivp_desc: input.reason.slice(0, 120), // Telr caps description at ~127 chars
      ivp_cart: input.refundRef,
    });
    const res = await fetch('https://secure.telr.com/gateway/order.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    type TelrRefundResponse = {
      order?: { ref: string; transaction?: { ref: string; status: string; message?: string } };
      error?: { message: string };
    };
    const json = (await res.json()) as TelrRefundResponse;
    if (!res.ok || json.error || !json.order) {
      return {
        refunded: false,
        message: json.error?.message ?? `Telr refund failed (HTTP ${res.status})`,
      };
    }
    const tx = json.order.transaction;
    const txStatus = tx?.status;
    return {
      refunded: txStatus === 'A' || txStatus === 'paid',
      externalRef: tx?.ref ?? json.order.ref,
      message: tx?.message,
    };
  }

  /**
   * Re-query Telr to verify a webhook claim. Call this from the router AFTER
   * parseWebhook() before flipping the booking to confirmed.
   */
  async verifyOrder(orderRef: string): Promise<{ paid: boolean; message?: string }> {
    const body = new URLSearchParams({
      ivp_method: 'check',
      ivp_store: this.cfg.storeId,
      ivp_authkey: this.cfg.authKey,
      order_ref: orderRef,
    });
    const res = await fetch('https://secure.telr.com/gateway/order.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const json = (await res.json()) as TelrCheckResponse;
    if (!res.ok || json.error || !json.order) {
      return { paid: false, message: json.error?.message ?? res.statusText };
    }
    const txStatus = json.order.transaction?.status;
    return {
      paid: txStatus === 'A' || txStatus === 'paid',
      message: json.order.transaction?.message,
    };
  }
}
