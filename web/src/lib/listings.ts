import "server-only";
import { Prisma, type ListingMode, type PropertyType } from "@prisma/client";
import { z } from "zod";
import { db } from "./db";
import { FURNISHING, MODE_KEYS, TYPE_KEYS, type FurnishingKey, type Mode, type PropType } from "./catalog";
import { publicPoint } from "./geo";
import { smallVariant } from "./storage";

export const PER_PAGE = 12;

// ───────────────────────── Search params ─────────────────────────

const num = z.coerce.number().int().nonnegative().catch(0);
const flag = z.preprocess((v) => v === "1" || v === "true" || v === true, z.boolean());

/** Parses untrusted query-string values. Anything invalid falls back to "no filter" instead of erroring. */
export const searchSchema = z.object({
  mode: z.enum(MODE_KEYS as [Mode, ...Mode[]]).optional().catch(undefined),
  type: z.enum(TYPE_KEYS as [PropType, ...PropType[]]).optional().catch(undefined),
  q: z.string().trim().max(100).optional().catch(undefined),
  min: num,
  max: num,
  beds: num,
  baths: num,
  minArea: num,
  furnishing: z.enum(Object.values(FURNISHING) as [string, ...string[]]).optional().catch(undefined),
  term: num,
  verified: flag,
  pets: flag,
  amenities: z.preprocess((v) => (typeof v === "string" && v ? v.split("|").slice(0, 10) : []), z.array(z.string().max(60))),
  ids: z.preprocess((v) => (typeof v === "string" && v ? v.split(",").slice(0, 100) : []), z.array(z.string().max(20))),
  sort: z.enum(["relevance", "newest", "price-asc", "price-desc", "area-desc"]).catch("relevance"),
  page: z.coerce.number().int().min(1).max(1000).catch(1),
});
export type SearchFilters = z.infer<typeof searchSchema>;

export function parseSearch(params: Record<string, string | string[] | undefined> | URLSearchParams): SearchFilters {
  const flat: Record<string, string> = {};
  if (params instanceof URLSearchParams) params.forEach((v, k) => (flat[k] = v));
  else for (const [k, v] of Object.entries(params)) if (v !== undefined) flat[k] = Array.isArray(v) ? v[0] : v;
  return searchSchema.parse(flat);
}

// ───────────────────────── DTOs ─────────────────────────

const cardSelect = {
  refCode: true, mode: true, type: true, title: true, description: true, price: true,
  bedrooms: true, bathrooms: true, floorArea: true, lotArea: true, terms: true,
  featuredUntil: true, verifiedAt: true, publishedAt: true, lat: true, lng: true, hideAddress: true,
  city: { select: { name: true } },
  area: { select: { name: true } },
  photos: { select: { storageKey: true }, orderBy: { position: "asc" } },
} satisfies Prisma.ListingSelect;

type CardRow = Prisma.ListingGetPayload<{ select: typeof cardSelect }>;

export type ListingCard = {
  ref: string;
  mode: Mode;
  type: PropType;
  title: string;
  description: string;
  price: number;
  beds: number | null;
  baths: number | null;
  floorArea: number | null;
  lotArea: number | null;
  city: string;
  area: string | null;
  photo: string | null;
  photoCount: number;
  featured: boolean;
  verified: boolean;
  publishedAt: string | null;
  terms: Record<string, unknown>;
  /** Map position: exact only if the poster chose to show it. */
  point: { lat: number; lng: number; exact: boolean } | null;
};

function toCard(r: CardRow): ListingCard {
  return {
    ref: r.refCode,
    mode: r.mode.toLowerCase() as Mode,
    type: r.type.toLowerCase() as PropType,
    title: r.title,
    description: r.description,
    price: r.price.toNumber(),
    beds: r.bedrooms,
    baths: r.bathrooms,
    floorArea: r.floorArea,
    lotArea: r.lotArea,
    city: r.city.name,
    area: r.area?.name ?? null,
    photo: r.photos[0] ? smallVariant(r.photos[0].storageKey) : null,
    photoCount: r.photos.length,
    featured: !!r.featuredUntil && r.featuredUntil > new Date(),
    verified: !!r.verifiedAt,
    publishedAt: r.publishedAt?.toISOString() ?? null,
    terms: (r.terms ?? {}) as Record<string, unknown>,
    point: publicPoint(r),
  };
}

// ───────────────────────── Search ─────────────────────────

/** Location ids whose name matches a word, ignoring case and accents ("paranaque" finds "Parañaque"). */
async function locationIdsMatching(word: string): Promise<string[]> {
  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Location" WHERE unaccent(name) ILIKE unaccent(${"%" + word + "%"}) LIMIT 200`;
  return rows.map((r) => r.id);
}

async function buildWhere(f: SearchFilters): Promise<Prisma.ListingWhereInput> {
  const and: Prisma.ListingWhereInput[] = [{ status: "ACTIVE" }];
  if (f.mode) and.push({ mode: f.mode.toUpperCase() as ListingMode });
  if (f.type) and.push({ type: f.type.toUpperCase() as PropertyType });
  if (f.min) and.push({ price: { gte: f.min } });
  if (f.max) and.push({ price: { lte: f.max } });
  if (f.beds) and.push({ bedrooms: { gte: f.beds } });
  if (f.baths) and.push({ bathrooms: { gte: f.baths } });
  if (f.minArea) and.push({ OR: [{ floorArea: { gte: f.minArea } }, { lotArea: { gte: f.minArea } }] });
  if (f.furnishing) {
    const key = (Object.keys(FURNISHING) as FurnishingKey[]).find((k) => FURNISHING[k] === f.furnishing);
    if (key) and.push({ furnishing: key });
  }
  if (f.term) and.push({ mode: "LEASE", terms: { path: ["minTermYears"], lte: f.term } });
  if (f.pets) and.push({ terms: { path: ["petFriendly"], equals: true } });
  if (f.verified) and.push({ verifiedAt: { not: null } });
  for (const name of f.amenities) and.push({ amenities: { some: { amenity: { name } } } });
  if (f.ids.length) and.push({ refCode: { in: f.ids } });

  if (f.q) {
    const words = f.q.split(/[\s,]+/).filter((w) => w.length > 1).slice(0, 5);
    for (const w of words) {
      const locIds = await locationIdsMatching(w);
      and.push({
        OR: [
          { title: { contains: w, mode: "insensitive" } },
          ...(locIds.length ? [{ cityId: { in: locIds } }, { areaId: { in: locIds } }, { city: { parentId: { in: locIds } } }] : []),
        ],
      });
    }
  }
  return { AND: and };
}

function orderBy(sort: SearchFilters["sort"]): Prisma.ListingOrderByWithRelationInput[] {
  switch (sort) {
    case "newest": return [{ publishedAt: "desc" }];
    case "price-asc": return [{ price: "asc" }, { publishedAt: "desc" }];
    case "price-desc": return [{ price: "desc" }, { publishedAt: "desc" }];
    case "area-desc": return [{ floorArea: { sort: "desc", nulls: "last" } }, { lotArea: { sort: "desc", nulls: "last" } }];
    default: return [
      { featuredUntil: { sort: "desc", nulls: "last" } },
      { verifiedAt: { sort: "desc", nulls: "last" } },
      { publishedAt: "desc" },
    ];
  }
}

export async function searchListings(f: SearchFilters) {
  const where = await buildWhere(f);
  const [total, rows] = await db.$transaction([
    db.listing.count({ where }),
    db.listing.findMany({ where, select: cardSelect, orderBy: orderBy(f.sort), skip: (f.page - 1) * PER_PAGE, take: PER_PAGE }),
  ]);
  return { total, page: f.page, pages: Math.max(1, Math.ceil(total / PER_PAGE)), items: rows.map(toCard) };
}

// ───────────────────────── Home page data ─────────────────────────

export async function getHomeData() {
  const active = { status: "ACTIVE" } as const;
  const [byModeType, featured, latest, byCity] = await Promise.all([
    db.listing.groupBy({ by: ["mode", "type"], where: active, _count: true }),
    Promise.all(MODE_KEYS.map((m) =>
      db.listing.findMany({
        where: { ...active, mode: m.toUpperCase() as ListingMode },
        select: cardSelect, orderBy: orderBy("relevance"), take: 8,
      }))),
    db.listing.findMany({ where: active, select: cardSelect, orderBy: { publishedAt: "desc" }, take: 4 }),
    db.listing.groupBy({ by: ["cityId"], where: active, _count: true }),
  ]);

  const counts: Record<string, number> = {};
  for (const r of byModeType) {
    const m = r.mode.toLowerCase(), t = r.type.toLowerCase();
    counts[`${m}:${t}`] = r._count;
    counts[m] = (counts[m] ?? 0) + r._count;
  }
  const cities = await db.location.findMany({
    where: { id: { in: byCity.map((c) => c.cityId) } },
    select: { id: true, name: true, parent: { select: { name: true } } },
  });
  const cityCounts = Object.fromEntries(cities.map((c) => [c.name, {
    count: byCity.find((b) => b.cityId === c.id)?._count ?? 0,
    province: c.parent?.name ?? "",
  }]));

  return {
    counts,
    cityCounts,
    featured: Object.fromEntries(MODE_KEYS.map((m, i) => [m, featured[i].map(toCard)])) as Record<Mode, ListingCard[]>,
    latest: latest.map(toCard),
  };
}

/** Per mode+type counts for the header dropdowns ("buy:condo" → 10). */
export async function getMenuCounts() {
  const rows = await db.listing.groupBy({ by: ["mode", "type"], where: { status: "ACTIVE" }, _count: true });
  return Object.fromEntries(rows.map((r) => [`${r.mode.toLowerCase()}:${r.type.toLowerCase()}`, r._count])) as Record<string, number>;
}

// ───────────────────────── Detail ─────────────────────────

export async function getListing(ref: string) {
  const l = await db.listing.findUnique({
    where: { refCode: ref },
    include: {
      photos: { orderBy: { position: "asc" } },
      amenities: { include: { amenity: true } },
      city: { include: { parent: true } },
      area: true,
      agent: { select: { name: true, phone: true, agentProfile: { include: { agency: true } } } },
      poster: { select: { name: true, role: true } },
    },
  });
  // Drafts, pending, rejected and archived listings are not public.
  if (!l || !["ACTIVE", "CLOSED", "EXPIRED"].includes(l.status)) return null;
  return l;
}
export type ListingDetail = NonNullable<Awaited<ReturnType<typeof getListing>>>;

export async function getSimilar(l: ListingDetail) {
  const rows = await db.listing.findMany({
    where: { status: "ACTIVE", mode: l.mode, id: { not: l.id }, OR: [{ type: l.type }, { cityId: l.cityId }] },
    select: cardSelect,
    orderBy: orderBy("relevance"),
    take: 4,
  });
  return rows.map(toCard);
}

/** Cities (with known areas) for the listing form. */
export async function getCityOptions() {
  const cities = await db.location.findMany({
    where: { level: "CITY" },
    select: { id: true, name: true, lat: true, lng: true, parent: { select: { name: true } }, children: { select: { name: true }, orderBy: { name: "asc" } } },
    orderBy: { name: "asc" },
  });
  return cities.map((c) => ({ id: c.id, name: c.name, province: c.parent?.name ?? "", lat: c.lat, lng: c.lng, areas: c.children.map((a) => a.name) }));
}
