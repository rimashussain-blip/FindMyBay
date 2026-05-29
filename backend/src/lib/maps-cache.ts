// In-memory cache for Google Distance Matrix estimates.
//
// Spec §10.4: "Cache Distance Matrix responses for 3 minutes per
//   (origin grid 250 m, destination, hour)."
//
// At MVP we run a single backend instance, so a process-local Map is fine.
// When we scale out (multi-instance behind a load balancer) this should move
// to Redis — the existing Redis container is already wired in docker-compose,
// just no Node client today. TODO: swap to a `mapsCache.get/set` Redis-backed
// implementation when we deploy multi-instance.

import { logger } from './logger.js';

interface CachedEstimate {
  durationSeconds: number;
  cachedAt: number; // epoch ms
}

const TTL_MS = 3 * 60 * 1000;
// 1° latitude ≈ 111 km; 0.00225° ≈ 250 m. Same step on lng — close enough at
// UAE latitudes (cos(25°) ≈ 0.91, so a "250m" lng cell is ~227m E-W). The
// goal is bucketing customers walking around inside the same neighbourhood,
// not surveying.
const GRID_DEG = 0.00225;

const cache = new Map<string, CachedEstimate>();

function gridify(n: number): string {
  return (Math.round(n / GRID_DEG) * GRID_DEG).toFixed(5);
}

function buildKey(originLat: number, originLng: number, destLat: number, destLng: number): string {
  // Hour bucket means a 9am cached value won't survive past the next hour
  // (or get used at 9pm) — traffic patterns vary by time of day.
  const hour = new Date().getUTCHours();
  return `${gridify(originLat)},${gridify(originLng)}|${destLat.toFixed(6)},${destLng.toFixed(6)}|h${hour}`;
}

/** Returns the cached duration in seconds, or null if miss/expired. */
export function getCachedEstimate(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
): { durationSeconds: number } | null {
  const key = buildKey(originLat, originLng, destLat, destLng);
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > TTL_MS) {
    cache.delete(key);
    return null;
  }
  return { durationSeconds: entry.durationSeconds };
}

/** Insert or refresh a cached estimate. */
export function putCachedEstimate(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
  durationSeconds: number,
): void {
  const key = buildKey(originLat, originLng, destLat, destLng);
  cache.set(key, { durationSeconds, cachedAt: Date.now() });
}

// Periodic prune so we don't leak memory when bookings finish but their
// cached entries stay around. Once a minute is plenty given 3-min TTL.
const PRUNE_INTERVAL_MS = 60 * 1000;
setInterval(() => {
  const now = Date.now();
  let removed = 0;
  for (const [key, entry] of cache.entries()) {
    if (now - entry.cachedAt > TTL_MS) {
      cache.delete(key);
      removed++;
    }
  }
  if (removed > 0) {
    logger.debug({ removed, size: cache.size }, 'maps-cache: pruned expired entries');
  }
}, PRUNE_INTERVAL_MS).unref();

/** Test/debug helper. */
export function _cacheSize(): number {
  return cache.size;
}
