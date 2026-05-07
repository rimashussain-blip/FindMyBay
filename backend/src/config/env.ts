// Centralised, validated env config. Fail fast at boot if anything is missing.

import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('debug'),

  DATABASE_URL: z.string().url(),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be ≥ 32 chars'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be ≥ 32 chars'),
  JWT_ACCESS_TTL_MIN: z.coerce.number().int().positive().default(15),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),

  OTP_DELIVERY: z.enum(['console', 'unifonic']).default('console'),
  OTP_TTL_MIN: z.coerce.number().int().positive().default(5),
  OTP_RESEND_COOLDOWN_SEC: z.coerce.number().int().nonnegative().default(30),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),

  CORS_ORIGINS: z.string().default('*'),

  // Maps & push (optional in dev; mock providers used when not set)
  GOOGLE_MAPS_API_KEY: z.string().optional().default(''),
  // For local dev: point at a service-account JSON file on disk.
  FIREBASE_SERVICE_ACCOUNT_PATH: z.string().optional().default(''),
  // For container deploys: the JSON content itself, injected as a secret env
  // var. Either FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_SERVICE_ACCOUNT_JSON
  // can be set; if both, JSON wins.
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().optional().default(''),
  // Google Sign-In: the **Web** OAuth client ID from your Firebase / Google
  // Cloud project. Required when /auth/google is enabled. This is the
  // "primary" / canonical audience — typically the auto-created Firebase web
  // client. Other accepted audiences live in the *_IOS / *_ANDROID_* vars
  // below, all OR'd together when verifying ID tokens.
  GOOGLE_OAUTH_CLIENT_ID: z.string().optional().default(''),
  // Additional audiences /auth/google should accept. When set, ID tokens
  // whose `aud` claim matches ANY of these are valid. Lets one backend serve
  // iOS + Android (release + debug) without per-platform handlers, and lets
  // us roll over the primary client ID without downtime.
  GOOGLE_OAUTH_CLIENT_ID_IOS: z.string().optional().default(''),
  GOOGLE_OAUTH_CLIENT_ID_ANDROID: z.string().optional().default(''),
  GOOGLE_OAUTH_CLIENT_ID_ANDROID_DEBUG: z.string().optional().default(''),

  // Payments. `mock` returns a local hosted page that lets us click
  // succeed/fail buttons without contacting any third party — good for dev
  // and CI. `telr` uses Telr's hosted-payment-page API.
  PAYMENT_PROVIDER: z.enum(['mock', 'telr']).default('mock'),
  // Public origin of THIS api (e.g. https://api.findmybay.ae). Used to build
  // return URLs and webhook callbacks the processor calls back into.
  PUBLIC_API_BASE_URL: z.string().url().default('http://localhost:3000'),
  // Deep link the Android app registers; the hosted page redirects here
  // when payment finishes so we can close the Custom Tab and resume.
  PAYMENT_RETURN_DEEP_LINK: z.string().default('findmybay://payment/return'),

  // Telr (only required when PAYMENT_PROVIDER=telr)
  TELR_STORE_ID: z.string().optional().default(''),
  TELR_AUTH_KEY: z.string().optional().default(''),
  TELR_TEST_MODE: z.coerce.boolean().default(true),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('❌ Invalid environment variables:');
  // eslint-disable-next-line no-console
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isDev = env.NODE_ENV === 'development';
export const isProd = env.NODE_ENV === 'production';
