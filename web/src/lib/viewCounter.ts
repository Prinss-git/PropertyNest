import "server-only";
import { db } from "./db";

// Listing views are counted in memory and written in one query every 15 seconds, so a popular listing
// costs one database write per flush instead of one per visitor. A crash can lose up to 15 s of counts,
// which is fine for a view counter. With Redis (Phase 3) this buffer moves there and survives restarts.

const FLUSH_MS = 15_000;
const MAX_KEYS = 5_000;
let pending = new Map<string, number>();
let timer: ReturnType<typeof setTimeout> | null = null;

export function countView(refCode: string) {
  pending.set(refCode, (pending.get(refCode) ?? 0) + 1);
  if (pending.size >= MAX_KEYS) void flushViews();
  else if (!timer) timer = setTimeout(() => void flushViews(), FLUSH_MS);
}

export async function flushViews() {
  if (timer) clearTimeout(timer);
  timer = null;
  if (!pending.size) return;
  const batch = pending;
  pending = new Map();
  const refs = [...batch.keys()];
  const counts = refs.map((r) => batch.get(r)!);
  try {
    // One statement: bump the listing totals and the per-day stats (Philippine date) for owners' charts.
    await db.$executeRaw`
      WITH v AS (SELECT * FROM unnest(${refs}::text[], ${counts}::int[]) AS t(ref, n)),
      u AS (
        UPDATE "Listing" l SET "viewCount" = l."viewCount" + v.n
        FROM v WHERE l."refCode" = v.ref AND l.status = 'ACTIVE'
        RETURNING l.id, v.n
      )
      INSERT INTO "ListingStatDaily" ("listingId", "date", "views")
      SELECT id, (now() AT TIME ZONE 'Asia/Manila')::date, n FROM u
      ON CONFLICT ("listingId", "date") DO UPDATE SET "views" = "ListingStatDaily"."views" + EXCLUDED."views"`;
  } catch (e) {
    console.error("Couldn't save listing views:", e);
  }
}

/** Crawlers and link previews shouldn't count as people looking at a listing. */
export function isBot(userAgent: string | null) {
  return !userAgent || /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse|curl|wget|python|httpclient/i.test(userAgent);
}
