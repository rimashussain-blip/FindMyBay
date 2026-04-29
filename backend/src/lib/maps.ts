// Distance Matrix client.
//
// Two providers:
//   - "mock"    → returns a deterministic duration based on Haversine + a fake
//                 traffic multiplier. Zero external dependencies, perfect for dev.
//   - "google"  → calls Google Distance Matrix API with departure_time=now and
//                 traffic_model=best_guess. Requires GOOGLE_MAPS_API_KEY.

import { env } from '../config/env.js';
import { logger } from './logger.js';

export interface TravelEstimate {
  /** Travel duration in seconds, including live traffic. */
  durationSeconds: number;
  /** Distance in meters. */
  distanceMeters: number;
  /** Provider that produced this estimate ("mock" or "google"). */
  provider: 'mock' | 'google';
}

export interface MapsClient {
  estimate(originLat: number, originLng: number, destLat: number, destLng: number): Promise<TravelEstimate>;
}

// ---------- Mock provider ----------

const MOCK_KMH_OFF_PEAK = 50;
const MOCK_KMH_PEAK = 18;

function isPeakHourUae(): boolean {
  // Rough UAE peak: 07:00-09:30 and 17:00-19:30 local (GMT+4).
  const utcHour = new Date().getUTCHours();
  const uaeHour = (utcHour + 4) % 24;
  const uaeMin = new Date().getUTCMinutes();
  const cur = uaeHour + uaeMin / 60;
  return (cur >= 7 && cur < 9.5) || (cur >= 17 && cur < 19.5);
}

function haversineMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(a));
}

class MockMapsClient implements MapsClient {
  async estimate(originLat: number, originLng: number, destLat: number, destLng: number): Promise<TravelEstimate> {
    const distance = haversineMeters(originLat, originLng, destLat, destLng);
    const kmh = isPeakHourUae() ? MOCK_KMH_PEAK : MOCK_KMH_OFF_PEAK;
    // Add a fixed 3 minutes for parking + reaching the bay; keeps small distances realistic.
    const durationSeconds = Math.round((distance / 1000 / kmh) * 3600 + 180);
    return { durationSeconds, distanceMeters: distance, provider: 'mock' };
  }
}

// ---------- Google provider ----------

class GoogleMapsClient implements MapsClient {
  constructor(private readonly apiKey: string) {}

  async estimate(originLat: number, originLng: number, destLat: number, destLng: number): Promise<TravelEstimate> {
    const params = new URLSearchParams({
      origins: `${originLat},${originLng}`,
      destinations: `${destLat},${destLng}`,
      mode: 'driving',
      departure_time: 'now',
      traffic_model: 'best_guess',
      key: this.apiKey,
    });
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?${params}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Distance Matrix HTTP ${resp.status}`);
    const json = (await resp.json()) as DmResponse;

    const elem = json.rows?.[0]?.elements?.[0];
    if (!elem || elem.status !== 'OK') {
      throw new Error(`Distance Matrix status: ${elem?.status ?? json.status}`);
    }

    return {
      durationSeconds: elem.duration_in_traffic?.value ?? elem.duration.value,
      distanceMeters: elem.distance.value,
      provider: 'google',
    };
  }
}

interface DmResponse {
  status: string;
  rows: { elements: { status: string; duration: { value: number }; duration_in_traffic?: { value: number }; distance: { value: number } }[] }[];
}

// ---------- Factory ----------

let cached: MapsClient | null = null;

export function getMapsClient(): MapsClient {
  if (cached) return cached;
  if (env.GOOGLE_MAPS_API_KEY && env.GOOGLE_MAPS_API_KEY.length > 0) {
    logger.info({ provider: 'google' }, 'Maps client initialised');
    cached = new GoogleMapsClient(env.GOOGLE_MAPS_API_KEY);
  } else {
    logger.info({ provider: 'mock' }, 'Maps client initialised (mock — set GOOGLE_MAPS_API_KEY for real Distance Matrix)');
    cached = new MockMapsClient();
  }
  return cached;
}
