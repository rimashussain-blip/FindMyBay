// Push notification client.
//
// Two providers:
//   - "console" → logs the push to the dev console. Default. Zero setup.
//   - "fcm"     → sends via Firebase Cloud Messaging. Picks up credentials
//                 from EITHER:
//                   FIREBASE_SERVICE_ACCOUNT_PATH (file path on disk; used
//                     for local dev)
//                   FIREBASE_SERVICE_ACCOUNT_JSON (JSON content as a string;
//                     used in container deploys where we inject it as an
//                     Azure Container Apps secret env var)
//                 If both are set, JSON wins.

import fs from 'node:fs';
import { env } from '../config/env.js';
import { logger } from './logger.js';

export interface PushMessage {
  /** Customer-facing title shown in the notification tray. */
  title: string;
  /** Body line shown under the title. */
  body: string;
  /** Arbitrary key/value data delivered with the notification. */
  data?: Record<string, string>;
}

export interface PushClient {
  send(deviceTokens: string[], message: PushMessage): Promise<{ delivered: number; failed: number }>;
}

// ---------- Console provider ----------

class ConsolePushClient implements PushClient {
  async send(tokens: string[], message: PushMessage): Promise<{ delivered: number; failed: number }> {
    if (tokens.length === 0) {
      logger.warn({ message }, 'PUSH (console): no tokens registered, skipping');
      return { delivered: 0, failed: 0 };
    }
    logger.info(
      { tokens: tokens.length, title: message.title, body: message.body, data: message.data },
      `\n┌─────────────────────────────────────────────────┐\n` +
        `│  📲  PUSH (console mode — no real FCM)          │\n` +
        `│  Title: ${message.title.padEnd(40).slice(0, 40)}│\n` +
        `│  Body:  ${message.body.padEnd(40).slice(0, 40)}│\n` +
        `│  Tokens: ${String(tokens.length).padEnd(38)} │\n` +
        `└─────────────────────────────────────────────────┘`,
    );
    return { delivered: tokens.length, failed: 0 };
  }
}

// ---------- FCM provider ----------

interface FcmMessage {
  token: string;
  notification: { title: string; body: string };
  data?: Record<string, string>;
  android: {
    priority: 'high';
    notification: { channelId: string; sound: string };
  };
}

interface FirebaseAdmin {
  messaging: () => { send: (message: FcmMessage) => Promise<string> };
}

/**
 * Either a file path on disk (`{ kind: 'path', value: '...' }`) or the
 * service-account JSON content as a string (`{ kind: 'json', value: '{...}' }`).
 */
type Credential = { kind: 'path'; value: string } | { kind: 'json'; value: string };

class FcmPushClient implements PushClient {
  private admin: FirebaseAdmin | null = null;

  constructor(private readonly credential: Credential) {}

  private async lazyInit(): Promise<FirebaseAdmin> {
    if (this.admin) return this.admin;
    // Dynamic import so projects without firebase-admin installed don't blow up.
    const adminModule = (await import('firebase-admin')) as unknown as {
      default: {
        apps: unknown[];
        initializeApp: (opts: unknown) => unknown;
        credential: { cert: (input: string | Record<string, unknown>) => unknown };
        messaging: () => { send: (msg: FcmMessage) => Promise<string> };
      };
    };
    const admin = adminModule.default;
    if (admin.apps.length === 0) {
      // For path: firebase-admin reads + parses the JSON itself.
      // For json: parse here and hand admin a credential object directly.
      const credInput =
        this.credential.kind === 'path'
          ? this.credential.value
          : (JSON.parse(this.credential.value) as Record<string, unknown>);
      admin.initializeApp({ credential: admin.credential.cert(credInput) });
    }
    this.admin = { messaging: admin.messaging.bind(admin) };
    return this.admin;
  }

  async send(tokens: string[], message: PushMessage): Promise<{ delivered: number; failed: number }> {
    if (tokens.length === 0) return { delivered: 0, failed: 0 };

    const admin = await this.lazyInit();
    let delivered = 0;
    let failed = 0;
    const deadTokens: string[] = [];
    await Promise.all(
      tokens.map(async (token) => {
        try {
          await admin.messaging().send({
            token,
            notification: { title: message.title, body: message.body },
            data: message.data,
            android: {
              priority: 'high',
              notification: { channelId: 'fmb_alerts', sound: 'default' },
            },
          });
          delivered++;
        } catch (err) {
          failed++;
          const code = (err as { errorInfo?: { code?: string } })?.errorInfo?.code;
          // FCM tells us the token is permanently invalid — drop it from the DB
          // so we don't keep retrying every push.
          if (
            code === 'messaging/registration-token-not-registered' ||
            code === 'messaging/invalid-registration-token' ||
            code === 'messaging/invalid-argument'
          ) {
            deadTokens.push(token);
          }
          logger.warn({ err, token: token.slice(0, 12), code }, 'FCM send failed');
        }
      }),
    );

    if (deadTokens.length > 0) {
      // Lazy import so this file doesn't take a hard dependency on prisma.
      const { prisma } = await import('../config/db.js');
      const result = await prisma.deviceToken.deleteMany({
        where: { fcmToken: { in: deadTokens } },
      });
      logger.info({ removed: result.count }, 'pruned dead FCM tokens');
    }

    return { delivered, failed };
  }
}

// ---------- Factory ----------

let cached: PushClient | null = null;

export function getPushClient(): PushClient {
  if (cached) return cached;

  // Resolution order:
  //   1. FIREBASE_SERVICE_ACCOUNT_BASE64 — base64-encoded JSON. Workaround
  //      for shell quote-mangling when uploading the secret on Windows
  //      (Azure CLI on cmd.exe truncates raw JSON at embedded "). The
  //      base64 form has no special chars and survives any shell.
  //   2. FIREBASE_SERVICE_ACCOUNT_JSON — raw JSON content. Works on
  //      Linux / when uploaded via Portal / via Bicep / via PowerShell-with-
  //      arg-arrays.
  //   3. FIREBASE_SERVICE_ACCOUNT_PATH — file on disk. Local dev path.
  //   4. Fall back to console-only push client.
  const base64 = env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  const json = env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const path = env.FIREBASE_SERVICE_ACCOUNT_PATH;

  if (base64) {
    try {
      const decoded = Buffer.from(base64, 'base64').toString('utf8');
      logger.info({ provider: 'fcm', source: 'env-base64' }, 'Push client initialised (FCM)');
      cached = new FcmPushClient({ kind: 'json', value: decoded });
    } catch (err) {
      logger.error({ err }, 'FIREBASE_SERVICE_ACCOUNT_BASE64 set but failed to decode; falling back');
      cached = new ConsolePushClient();
    }
  } else if (json) {
    logger.info({ provider: 'fcm', source: 'env-json' }, 'Push client initialised (FCM)');
    cached = new FcmPushClient({ kind: 'json', value: json });
  } else if (path && fs.existsSync(path)) {
    logger.info({ provider: 'fcm', source: 'file', path }, 'Push client initialised (FCM)');
    cached = new FcmPushClient({ kind: 'path', value: path });
  } else {
    logger.info(
      { provider: 'console' },
      'Push client initialised (console — set FIREBASE_SERVICE_ACCOUNT_BASE64 / _JSON / _PATH for real FCM)',
    );
    cached = new ConsolePushClient();
  }
  return cached!;
}
