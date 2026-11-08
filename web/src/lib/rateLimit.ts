import "server-only";
import { HttpError } from "./auth";
import { db } from "./db";

/**
 * Allows at most `max` actions per `key` within `windowMs`, or throws a 429 with `message`.
 * Keys look like "signup:<ipHash>". Counted in Postgres for now (cleaned up daily by maintenance);
 * swap this one function for Redis when traffic needs it.
 */
export async function rateLimit(key: string, max: number, windowMs: number, message: string) {
  const recent = await db.rateEvent.count({ where: { key, createdAt: { gte: new Date(Date.now() - windowMs) } } });
  if (recent >= max) throw new HttpError(429, message);
  await db.rateEvent.create({ data: { key } });
}
