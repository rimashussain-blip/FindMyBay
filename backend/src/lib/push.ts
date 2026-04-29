// Push notification client.
//
// Two providers:
//   - "console" → logs the push to the dev console. Default. Zero setup.
//   - "fcm"     → sends via Firebase Cloud Messaging. Requires
//                 FIREBASE_SERVICE_ACCOUNT_PATH to point at a service account
//                 JSON downloaded from Firebase Console.

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

class FcmPushClient implements PushClient {
  private admin: FirebaseAdmin | null = null;

  constructor(private readonly serviceAccountPath: string) {}

  private async lazyInit(): Promise<FirebaseAdmin> {
    if (this.admin) return this.admin;
    // Dynamic import so projects without firebase-admin installed don't blow up.
    const adminModule = (await import('firebase-admin')) as unknown as {
      default: {
        apps: unknown[];
        initializeApp: (opts: unknown) => unknown;
        credential: { cert: (path: string) => unknown };
        messaging: () => { send: (msg: FcmMessage) => Promise<string> };
      };
    };
    const admin = adminModule.default;
    if (admin.apps.length === 0) {
      admin.initializeApp({ credential: admin.credential.cert(this.serviceAccountPath) });
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
  const path = env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (path && fs.existsSync(path)) {
    logger.info({ provider: 'fcm', path }, 'Push client initialised (FCM)');
    cached = new FcmPushClient(path);
  } else {
    logger.info(
      { provider: 'console' },
      'Push client initialised (console — set FIREBASE_SERVICE_ACCOUNT_PATH for real FCM)',
    );
    cached = new ConsolePushClient();
  }
  return cached;
}
