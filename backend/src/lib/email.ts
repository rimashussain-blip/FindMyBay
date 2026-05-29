// Tiny email-delivery shim used by the auth flows (password reset +
// email verification). Two backends:
//   - 'console' (dev / preview) — pretty-prints the email to stdout
//     so we can copy the link without a real provider account.
//   - 'postmark' — hits Postmark's /email API.
//
// Add new providers by extending the switch in `sendEmail()` and the
// EMAIL_DELIVERY enum in env.ts. Call sites stay unchanged.

import { env } from '../config/env.js';
import { logger } from './logger.js';
import { HttpError } from './error.js';

export interface EmailPayload {
  to: string;
  subject: string;
  /** Plaintext body. Required. */
  text: string;
  /** Optional HTML body. Falls back to a trivial <pre> wrap of `text`. */
  html?: string;
  /** Tag for analytics. Postmark uses this to group identical emails. */
  tag?: string;
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
  switch (env.EMAIL_DELIVERY) {
    case 'console':
      logger.info(
        `\n  ┌────── 📧  email ──────────────────────────────────────────\n` +
          `  │  to:      ${payload.to}\n` +
          `  │  subject: ${payload.subject}\n` +
          `  │  tag:     ${payload.tag ?? '(none)'}\n` +
          `  ├──────────────────────────────────────────────────────────\n` +
          payload.text
            .split('\n')
            .map((l) => `  │  ${l}`)
            .join('\n') +
          `\n  └──────────────────────────────────────────────────────────\n`,
      );
      return;

    case 'postmark':
      if (!env.POSTMARK_TOKEN) {
        throw new HttpError(500, 'POSTMARK_TOKEN not configured', { code: 'email_provider' });
      }
      await sendViaPostmark(payload);
      return;

    case 'acs':
      if (!env.ACS_CONNECTION_STRING) {
        throw new HttpError(500, 'ACS_CONNECTION_STRING not configured', { code: 'email_provider' });
      }
      await sendViaAcs(payload);
      return;

    default:
      throw new HttpError(500, `Unknown EMAIL_DELIVERY: ${env.EMAIL_DELIVERY as string}`);
  }
}

// Azure Communication Services Email. The SDK handles the HMAC request
// signing, so we let it own the connection string. `beginSend` submits the
// message (202 Accepted) and returns a poller; we don't block on full
// delivery — submission success is enough for a transactional send.
async function sendViaAcs(payload: EmailPayload): Promise<void> {
  // Lazy import so the SDK only loads when the ACS provider is selected.
  const { EmailClient } = await import('@azure/communication-email');
  const client = new EmailClient(env.ACS_CONNECTION_STRING);
  const senderAddress = env.EMAIL_FROM;
  try {
    await client.beginSend({
      senderAddress,
      content: {
        subject: payload.subject,
        plainText: payload.text,
        html:
          payload.html ??
          `<pre style="font-family:system-ui,-apple-system">${escapeHtml(payload.text)}</pre>`,
      },
      recipients: { to: [{ address: payload.to }] },
    });
  } catch (err) {
    logger.error({ err }, 'acs email send failed');
    throw new HttpError(502, 'Email provider rejected the message', {
      code: 'email_send_failed',
    });
  }
}

async function sendViaPostmark(payload: EmailPayload): Promise<void> {
  // Postmark transactional API. Their HTTP endpoint is documented at
  // https://postmarkapp.com/developer/api/email-api. We use fetch
  // (Node 20 native) rather than pulling in their SDK — keeps the
  // dep tree small and the call is simple.
  const fromHeader = `${env.EMAIL_FROM_NAME} <${env.EMAIL_FROM}>`;
  const body = {
    From: fromHeader,
    To: payload.to,
    Subject: payload.subject,
    TextBody: payload.text,
    HtmlBody: payload.html ?? `<pre style="font-family:system-ui,-apple-system">${escapeHtml(payload.text)}</pre>`,
    MessageStream: 'outbound',
    Tag: payload.tag,
  };

  const res = await fetch('https://api.postmarkapp.com/email', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Postmark-Server-Token': env.POSTMARK_TOKEN,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    logger.error({ status: res.status, text }, 'postmark send failed');
    throw new HttpError(502, 'Email provider rejected the message', {
      code: 'email_send_failed',
      details: { status: res.status },
    });
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
