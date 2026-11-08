// Nearby places (schools, hospitals, malls, stations, parks...) for the property map.
// Used by the worker and the web app, so no Next.js-only imports.
//
// Places are cached per ~1 km grid cell in NearbyCell. NEARBY_PROVIDER picks the source:
//   nominatim (default): OpenStreetMap, free, ~1 request per second, light use only (development, demos).
//   geoapify: paid places API (what Lamudi uses), one request per cell; set GEOAPIFY_API_KEY. For launch.
//   none: no lookups (tests and CI).
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

/** Geoapify category → our category and label. First match wins, so specific categories come first. */
const GEOAPIFY_MAP: [string, NearbyCategory, string][] = [
  ["education.university", "education", "University"],
  ["education.college", "education", "University"],
  ["childcare.kindergarten", "education", "Preschool"],
  ["education.school", "education", "School"],
  ["healthcare.hospital", "healthcare", "Hospital"],
  ["healthcare.clinic_or_praxis", "healthcare", "Clinic"],
  ["healthcare.pharmacy", "healthcare", "Pharmacy"],
  ["commercial.shopping_mall", "services", "Mall"],
  ["commercial.supermarket", "services", "Supermarket"],
  ["service.financial.bank", "services", "Bank"],
  ["service.police", "services", "Police"],
  ["religion.place_of_worship", "services", "Church"],
  ["leisure.park", "leisure", "Park"],
  ["sport.fitness", "leisure", "Gym"],
  ["entertainment.cinema", "leisure", "Cinema"],
  ["public_transport.train", "transport", "Train station"],
  ["public_transport.subway", "transport", "Train station"],
  ["public_transport.bus", "transport", "Bus station"],
];

/**
 * Geoapify Places API (what Lamudi uses): one request per cell instead of one per category, and fine for
 * production volume. Needs GEOAPIFY_API_KEY. Not yet tested against the live API (no key during development).
 */
async function fetchCellFromGeoapify(key: string): Promise<NearbyPlace[]> {
  const apiKey = process.env.GEOAPIFY_API_KEY;
  if (!apiKey) throw new Error("GEOAPIFY_API_KEY is not set");
  const [lat, lng] = key.split(",").map(Number);
  const pad = 0.016;
  const params = new URLSearchParams({
    categories: [...new Set(GEOAPIFY_MAP.map(([c]) => c))].join(","),
    filter: `rect:${lng - pad},${lat + pad},${lng + pad},${lat - pad}`,
    limit: "500",
    lang: "en",
    apiKey,
  });
  const res = await fetch(`https://api.geoapify.com/v2/places?${params}`, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`Geoapify ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { features?: { properties: { name?: string; lat: number; lon: number; categories?: string[] } }[] };
  const out: NearbyPlace[] = [];
  const seen = new Set<string>();
  for (const f of data.features ?? []) {
    const p = f.properties;
    if (!p.name) continue;
    const match = GEOAPIFY_MAP.find(([c]) => p.categories?.some((pc) => pc === c || pc.startsWith(c + ".")));
    if (!match) continue;
    const id = `${p.name.toLowerCase()}|${p.lat.toFixed(4)}|${p.lon.toFixed(4)}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ name: p.name, cat: match[1], type: match[2], lat: +p.lat.toFixed(6), lng: +p.lon.toFixed(6) });
  }
  return out;
}

/** Fills one cell (called by the worker). NEARBY_PROVIDER: nominatim (default) | geoapify | none. */
export async function fetchCell(key: string) {
  // A duplicate job for a cell that's already fresh does nothing (saves the places service).
  const cell = await db.nearbyCell.findUnique({ where: { key }, select: { status: true, fetchedAt: true } });
  if (cell?.status === "READY" && cell.fetchedAt && Date.now() - cell.fetchedAt.getTime() < CELL_MAX_AGE_MS) return;
  const provider = process.env.NEARBY_PROVIDER ?? "nominatim";
  try {
    const places =
      provider === "geoapify" ? await fetchCellFromGeoapify(key)
      : provider === "none" ? [] // tests and CI: don't call outside services
      : await fetchCellFromNominatim(key);
    await db.nearbyCell.update({ where: { key }, data: { status: "READY", places, provider, error: null, fetchedAt: new Date() } });
  } catch (e) {
    await db.nearbyCell.update({ where: { key }, data: { status: "FAILED", error: String(e).slice(0, 500) } });
    throw e;
  }
}

/** Places get re-fetched after this long, since shops open and close. */
export const CELL_MAX_AGE_MS = 90 * 864e5;
