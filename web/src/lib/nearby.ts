// Nearby places (schools, hospitals, malls, stations, parks...) for the property map.
// Used by the worker and the web app, so no Next.js-only imports.
//
// Data comes from OpenStreetMap through Nominatim, cached per ~1 km grid cell in NearbyCell.
// Nominatim's usage policy allows about 1 request per second and asks heavy users to self-host,
// so production should switch to a paid places API (e.g. Geoapify, which Lamudi uses) or a
// self-hosted Nominatim/Overpass, behind the same fetchCell() function.
import { db } from "./db";

export type NearbyCategory = "education" | "healthcare" | "services" | "leisure" | "transport";
export type NearbyPlace = { name: string; cat: NearbyCategory; type: string; lat: number; lng: number };

/** Search terms per category (Nominatim "amenity" phrases), and the label shown on the map. */
const QUERIES: [NearbyCategory, string, string][] = [
  ["education", "school", "School"],
  ["education", "university", "University"],
  ["education", "kindergarten", "Preschool"],
  ["healthcare", "hospital", "Hospital"],
  ["healthcare", "clinic", "Clinic"],
  ["healthcare", "pharmacy", "Pharmacy"],
  ["services", "mall", "Mall"],
  ["services", "supermarket", "Supermarket"],
  ["services", "bank", "Bank"],
  ["services", "police", "Police"],
  ["services", "place of worship", "Church"],
  ["leisure", "park", "Park"],
  ["leisure", "gym", "Gym"],
  ["leisure", "cinema", "Cinema"],
  ["transport", "train station", "Train station"],
  ["transport", "bus station", "Bus station"],
];

/** Cells are 0.01° (~1.1 km). We fetch a box reaching 0.016° past the cell, so any point in it has 1 km covered. */
export function cellKey(lat: number, lng: number) {
  return `${lat.toFixed(2)},${lng.toFixed(2)}`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchCellFromNominatim(key: string): Promise<NearbyPlace[]> {
  const [lat, lng] = key.split(",").map(Number);
  const pad = 0.016;
  const viewbox = [lng - pad, lat + pad, lng + pad, lat - pad].join(",");
  const out: NearbyPlace[] = [];
  const seen = new Set<string>();
  for (const [cat, phrase, label] of QUERIES) {
    const url = `https://nominatim.openstreetmap.org/search?amenity=${encodeURIComponent(phrase)}&viewbox=${viewbox}&bounded=1&format=jsonv2&limit=25`;
    const res = await fetch(url, {
      headers: { "User-Agent": "PropertyNest/0.1 (property listings map)", "Accept-Language": "en" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`Nominatim ${res.status} for "${phrase}"`);
    const rows = (await res.json()) as { name?: string; lat: string; lon: string }[];
    for (const r of rows) {
      if (!r.name) continue; // unnamed POIs aren't useful in a "what's nearby" list
      const id = `${r.name.toLowerCase()}|${(+r.lat).toFixed(4)}|${(+r.lon).toFixed(4)}`;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({ name: r.name, cat, type: label, lat: +(+r.lat).toFixed(6), lng: +(+r.lon).toFixed(6) });
    }
    await sleep(1100); // Nominatim policy: max 1 request per second
  }
  return out;
}

/** Fills one cell (called by the worker). */
export async function fetchCell(key: string) {
  // A duplicate job for a cell that's already fresh does nothing (saves the places service).
  const cell = await db.nearbyCell.findUnique({ where: { key }, select: { status: true, fetchedAt: true } });
  if (cell?.status === "READY" && cell.fetchedAt && Date.now() - cell.fetchedAt.getTime() < CELL_MAX_AGE_MS) return;
  try {
    const places = await fetchCellFromNominatim(key);
    await db.nearbyCell.update({ where: { key }, data: { status: "READY", places, provider: "nominatim", error: null, fetchedAt: new Date() } });
  } catch (e) {
    await db.nearbyCell.update({ where: { key }, data: { status: "FAILED", error: String(e).slice(0, 500) } });
    throw e;
  }
}

/** Places get re-fetched after this long, since shops open and close. */
export const CELL_MAX_AGE_MS = 90 * 864e5;
