// Coordinates helpers. Plain module (no server-only) so the seed script can use it too.
import { createHash } from "node:crypto";

/** Great-circle distance in metres. */
export function distanceM(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371e3, rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad, dLng = (bLng - aLng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Radius of the "approximate location" circle shown when the poster hides the exact spot. */
export const APPROX_RADIUS_M = 400;

/**
 * For listings with a hidden address: a point up to 250 m from the real one, in a direction derived from
 * the listing ref, so it's stable across visits. A 400 m circle around it always contains the real spot,
 * but the real spot is never at the centre, and the exact coordinates never leave the server.
 */
export function approximatePoint(lat: number, lng: number, seed: string): { lat: number; lng: number } {
  const h = createHash("sha256").update(seed).digest();
  const angle = (h.readUInt16BE(0) / 65535) * 2 * Math.PI;
  const dist = 120 + (h.readUInt16BE(2) / 65535) * 130; // 120–250 m
  const dLat = (dist * Math.cos(angle)) / 111_320;
  const dLng = (dist * Math.sin(angle)) / (111_320 * Math.cos((lat * Math.PI) / 180));
  return { lat: lat + dLat, lng: lng + dLng };
}

/** Public coordinates for a listing: exact when the poster chose to show them, otherwise approximate. */
export function publicPoint(l: { lat: number | null; lng: number | null; hideAddress: boolean; refCode: string }) {
  if (l.lat == null || l.lng == null) return null;
  return l.hideAddress ? { ...approximatePoint(l.lat, l.lng, l.refCode), exact: false } : { lat: l.lat, lng: l.lng, exact: true };
}

/** Walking time at ~4.8 km/h, with a 1.3 detour factor because streets aren't straight lines. */
export function walkMinutes(metres: number) {
  return Math.max(1, Math.round((metres * 1.3) / 80));
}
