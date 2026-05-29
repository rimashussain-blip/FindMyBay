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

  // Email delivery for password reset + email verification.
  //   console  — log the email body to stdout (dev / preview)
  //   postmark — use Postmark's transactional API (POSTMARK_TOKEN required)
  //   acs      — Azure Communication Services Email (ACS_CONNECTION_STRING required)
  // Swap providers by adding a case in src/lib/email.ts; the call sites are
  // abstracted.
  EMAIL_DELIVERY: z.enum(['console', 'postmark', 'acs']).default('console'),
  POSTMARK_TOKEN: z.string().optional().default(''),
  // Azure Communication Services connection string for the 'acs' provider.
  // Format: endpoint=https://<res>.communication.azure.com/;accesskey=<key>
  ACS_CONNECTION_STRING: z.string().optional().default(''),
  // The "From" address on all outbound mail. Must be a verified sender
  // domain in Postmark. Falls back to a noreply@ on the configured
  // marketing domain so dev doesn't need a separate variable.
  EMAIL_FROM: z.string().email().default('noreply@findmybay.ae'),
  EMAIL_FROM_NAME: z.string().default('Find My Bay'),
  // Public URL of the vendor admin SPA — used in password-reset + email
  // verification links. Already set via VENDOR_ADMIN_URL above; kept
  // here as the canonical alias for email-link composition.
  // Customer-app email links use the same domain — Android intercepts
  // them via App Links once registered.

  CORS_ORIGINS: z.string().default('*'),

  // Public URL of the vendor-admin SPA (used to build staff-invite accept URLs).
  // e.g. https://admin.findmybay.ae — owner copies the resulting URL and shares
  // it manually with the invitee until Batch D ships email delivery.
  VENDOR_ADMIN_URL: z.string().url().optional(),

  // Maps & push (optional in dev; mock providers used when not set)
  GOOGLE_MAPS_API_KEY: z.string().optional().default(''),
  // For local dev: point at a service-account JSON file on disk.
  FIREBASE_SERVICE_ACCOUNT_PATH: z.string().optional().default(''),
  // For container deploys: the JSON content itself, injected as a secret env
  // var. Either FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_SERVICE_ACCOUNT_JSON
  // can be set; if both, JSON wins.
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().optional().default(''),
  // Base64-encoded alternative for FIREBASE_SERVICE_ACCOUNT_JSON. Workaround
  // for Azure CLI's argument-passing on Windows where multi-quote JSON
  // values get mangled when set via `az containerapp secret set --secrets`.
  // The encoded form has no special chars, so it survives any shell.
  // If set, takes precedence over the plain-JSON env var.
  FIREBASE_SERVICE_ACCOUNT_BASE64: z.string().optional().default(''),
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

  // Sign in with Apple: the iOS app's bundle id is also the OAuth `aud`
  // claim Apple signs into its identity tokens. We accept release and
  // debug bundles. Leaving both unset disables /auth/apple (returns 501).
  APPLE_BUNDLE_ID: z.string().optional().default(''),
  APPLE_BUNDLE_ID_DEBUG: z.string().optional().default(''),

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
