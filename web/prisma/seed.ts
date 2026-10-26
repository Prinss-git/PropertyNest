/**
 * Seeds the dev database with the same sample listings the static prototype shows.
 * Safe to re-run: it clears the seeded tables first.
 *
 *   npm run db:seed
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import {
  PrismaClient,
  Prisma,
  type AmenityCategory,
  type Furnishing,
  type ListingMode,
  type PropertyType,
} from "@prisma/client";
import { createHash } from "node:crypto";
import { hashPassword } from "../src/lib/password";
import { db as appDb } from "../src/lib/db";
import { publicPoint } from "../src/lib/geo";
import { ensureNearbyCell } from "../src/lib/jobs";
import { cellKey } from "../src/lib/nearby";
import { AREA_COORDS } from "./area-coords";

/** Stable pseudo-random number in [0,1) from a string, so re-seeding puts listings in the same spots. */
const unit = (s: string, salt: string) => createHash("sha256").update(salt + s).digest().readUInt32BE(0) / 2 ** 32;

const prisma = new PrismaClient();

// The generator is the prototype's browser script (it assigns window.PN_DATA), so run it in a sandbox.
type SampleListing = {
  id: string; mode: string; type: string; title: string; price: number;
  city: string; province: string; area: string; lat: number; lng: number;
  beds: number; baths: number; floor: number; land: number; parking: number;
  furnishing: string; amenities: string[]; images: string[];
  agent: { name: string; agency: string; phone: string; verified: boolean };
  posted: string; featured: boolean; verified: boolean; description: string;
  deposit?: number; advance?: number; minStay?: number; petFriendly?: boolean;
  minTerm?: number; escalation?: number; cusa?: number;
  titleStatus?: string; financing?: string[];
};
type SampleData = {
  LOCATIONS: { city: string; province: string; areas: string[]; lat: number; lng: number }[];
  AMENITIES: Record<"residential" | "commercial" | "lot", string[]>;
  AGENTS: { name: string; agency: string; phone: string; verified: boolean }[];
  LISTINGS: SampleListing[];
};
function loadSampleData(): SampleData {
  const sandbox = { window: {} as { PN_DATA?: SampleData } };
  vm.runInNewContext(readFileSync(join(__dirname, "sample-data.js"), "utf8"), sandbox);
  return sandbox.window.PN_DATA!;
}

const slugify = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const FURNISHING: Record<string, Furnishing> = {
  "Fully Furnished": "FULLY_FURNISHED",
  "Semi Furnished": "SEMI_FURNISHED",
  Unfurnished: "UNFURNISHED",
  Fitted: "FITTED",
  "Warm Shell": "WARM_SHELL",
  "Bare Shell": "BARE_SHELL",
  "N/A": "NOT_APPLICABLE",
};

const DAY = 864e5;
const DEMO_PASSWORD = "Nest-demo-2026";

async function main() {
  const data = loadSampleData();
  const now = Date.now();

  // Children before parents, so foreign keys never block the wipe.
  await prisma.$transaction([
    prisma.job.deleteMany(),
    // Nearby places are real OpenStreetMap data and slow to fetch, so finished cells survive a re-seed.
    prisma.nearbyCell.deleteMany({ where: { status: { not: "READY" } } }),
    prisma.outboundMessage.deleteMany(),
    prisma.otpCode.deleteMany(),
    prisma.authToken.deleteMany(),
    prisma.loginAttempt.deleteMany(),
    prisma.upload.deleteMany(),
    prisma.listingStatDaily.deleteMany(),
    prisma.report.deleteMany(),
    prisma.featuredBoost.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.subscription.deleteMany(),
    prisma.plan.deleteMany(),
    prisma.message.deleteMany(),
    prisma.viewing.deleteMany(),
    prisma.inquiry.deleteMany(),
    prisma.favorite.deleteMany(),
    prisma.savedSearch.deleteMany(),
    prisma.listingAmenity.deleteMany(),
    prisma.listingPhoto.deleteMany(),
    prisma.listing.deleteMany(),
    prisma.amenity.deleteMany(),
    prisma.location.deleteMany({ where: { level: "AREA" } }),
    prisma.location.deleteMany({ where: { level: "CITY" } }),
    prisma.location.deleteMany(),
    prisma.agentProfile.deleteMany(),
    prisma.agency.deleteMany(),
    prisma.session.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  // ── Locations: province → city → area ──
  const cityIds = new Map<string, string>();
  const areaIds = new Map<string, string>(); // key: "city|area"
  const provinceIds = new Map<string, string>();
  for (const loc of data.LOCATIONS) {
    let provinceId = provinceIds.get(loc.province);
    if (!provinceId) {
      const p = await prisma.location.create({
        data: { name: loc.province, slug: slugify(loc.province), level: loc.province === "Metro Manila" ? "REGION" : "PROVINCE" },
      });
      provinceId = p.id;
      provinceIds.set(loc.province, provinceId);
    }
    const citySlug = `${slugify(loc.province)}/${slugify(loc.city)}`;
    const city = await prisma.location.create({
      data: { name: loc.city, slug: citySlug, level: "CITY", parentId: provinceId, lat: loc.lat, lng: loc.lng },
    });
    cityIds.set(loc.city, city.id);
    for (const area of loc.areas) {
      const a = await prisma.location.create({
        data: { name: area, slug: `${citySlug}/${slugify(area)}`, level: "AREA", parentId: city.id, lat: AREA_COORDS[`${loc.city}|${area}`]?.[0], lng: AREA_COORDS[`${loc.city}|${area}`]?.[1] },
      });
      areaIds.set(`${loc.city}|${area}`, a.id);
    }
  }

  // ── Amenities (an amenity appearing in several pools keeps its first category) ──
  const amenityIds = new Map<string, string>();
  const pools: [AmenityCategory, string[]][] = [
    ["RESIDENTIAL", data.AMENITIES.residential],
    ["COMMERCIAL", data.AMENITIES.commercial],
    ["LOT", data.AMENITIES.lot],
  ];
  for (const [category, names] of pools) {
    for (const name of names) {
      if (amenityIds.has(name)) continue;
      const a = await prisma.amenity.create({ data: { name, slug: slugify(name), category } });
      amenityIds.set(name, a.id);
    }
  }

  // ── Agencies, agents, and a few staff / demo accounts ──
  const agencyIds = new Map<string, string>();
  const agentIds = new Map<string, string>();
  for (const [i, ag] of data.AGENTS.entries()) {
    let agencyId: string | undefined;
    if (ag.agency !== "Independent Broker") {
      agencyId = agencyIds.get(ag.agency);
      if (!agencyId) {
        const agency = await prisma.agency.create({ data: { name: ag.agency, slug: slugify(ag.agency), verifiedAt: ag.verified ? new Date() : null } });
        agencyId = agency.id;
        agencyIds.set(ag.agency, agencyId);
      }
    }
    const user = await prisma.user.create({
      data: {
        name: ag.name,
        email: `${slugify(ag.name).replace(/-/g, ".")}@example.com`,
        phone: ag.phone.replace(/\s/g, ""),
        role: "AGENT",
        phoneVerifiedAt: new Date(),
        agentProfile: {
          create: {
            agencyId,
            prcLicenseNo: ag.verified ? `REB-${String(20000 + i * 137).padStart(7, "0")}` : null,
            licenseVerifiedAt: ag.verified ? new Date() : null,
            publicPhone: ag.phone,
          },
        },
      },
    });
    agentIds.set(ag.name, user.id);
  }
  // Demo accounts: log in with email + DEMO_PASSWORD, or with the phone number via OTP.
  const demoHash = await hashPassword(DEMO_PASSWORD);
  await prisma.user.createMany({
    data: [
      // Sign in as these with the matching number (dev shows the SMS code on screen).
      { name: "Demo Owner", email: "owner@example.com", phone: "+639170000003", role: "OWNER", passwordHash: demoHash, emailVerifiedAt: new Date() },
      { name: "Demo Seeker", email: "seeker@example.com", phone: "+639170000004", role: "SEEKER", passwordHash: demoHash, emailVerifiedAt: new Date() },
      { name: "Mia Moderator", email: "moderator@example.com", phone: "+639170000001", role: "MODERATOR", passwordHash: demoHash, emailVerifiedAt: new Date() },
      { name: "Admin", email: "admin@example.com", phone: "+639170000002", role: "ADMIN", passwordHash: demoHash, emailVerifiedAt: new Date() },
    ],
  });

  // ── Plans (placeholder prices until pricing is decided) ──
  await prisma.plan.createMany({
    data: [
      { code: "owner-free", name: "Owner (free)", priceMonthly: 0, listingLimit: 3, featuredCredits: 0 },
      { code: "agent-basic", name: "Agent Basic", priceMonthly: 999, listingLimit: 30, featuredCredits: 2 },
      { code: "agent-pro", name: "Agent Pro", priceMonthly: 2499, listingLimit: 100, featuredCredits: 10 },
      { code: "agency", name: "Agency", priceMonthly: 7999, listingLimit: 500, featuredCredits: 40 },
    ],
  });

  // ── Listings ──
  for (const l of data.LISTINGS) {
    const mode = l.mode.toUpperCase() as ListingMode;
    const terms =
      mode === "BUY" ? { titleStatus: l.titleStatus, financing: l.financing ?? [] }
      : mode === "RENT" ? { depositMonths: l.deposit, advanceMonths: l.advance, minStayMonths: l.minStay, petFriendly: !!l.petFriendly }
      : { minTermYears: l.minTerm, escalationPct: l.escalation, depositMonths: l.deposit, advanceMonths: l.advance, cusaPerSqm: l.cusa || null };
    const agentId = agentIds.get(l.agent.name)!;
    const published = new Date(l.posted + "T08:00:00+08:00");
    await prisma.listing.create({
      data: {
        refCode: l.id,
        mode,
        type: l.type.toUpperCase() as PropertyType,
        status: "ACTIVE",
        title: l.title,
        description: l.description,
        price: new Prisma.Decimal(l.price),
        bedrooms: ["condo", "apartment", "house", "townhouse"].includes(l.type) ? l.beds : null,
        bathrooms: l.baths || null,
        floorArea: l.floor || null,
        lotArea: l.land || null,
        parking: l.type === "lot" ? null : l.parking,
        furnishing: FURNISHING[l.furnishing] ?? "NOT_APPLICABLE",
        terms,
        cityId: cityIds.get(l.city)!,
        areaId: areaIds.get(`${l.city}|${l.area}`),
        // Within ~400 m of the neighbourhood centre (falls back to the generator position).
        lat: (AREA_COORDS[`${l.city}|${l.area}`]?.[0] ?? l.lat) + (unit(l.id, "lat") - 0.5) * 0.007,
        lng: (AREA_COORDS[`${l.city}|${l.area}`]?.[1] ?? l.lng) + (unit(l.id, "lng") - 0.5) * 0.007,
        // Businesses usually show their exact spot; most home owners prefer an approximate area.
        hideAddress: ["office", "commercial", "warehouse", "lot"].includes(l.type) ? false : unit(l.id, "hide") < 0.7,
        posterId: agentId,
        agentId,
        agencyId: agencyIds.get(l.agent.agency),
        featuredUntil: l.featured ? new Date(now + 14 * DAY) : null,
        verifiedAt: l.verified ? published : null,
        publishedAt: published,
        expiresAt: new Date(now + 60 * DAY),
        createdAt: published,
        photos: { create: l.images.map((src, position) => ({ storageKey: "/" + src, position })) },
        amenities: { create: l.amenities.filter((a) => amenityIds.has(a)).map((a) => ({ amenityId: amenityIds.get(a)! })) },
      },
    });
  }

  // Queue nearby-place lookups for every neighbourhood, so maps are ready by the time anyone looks.
  const listings = await prisma.listing.findMany({ select: { refCode: true, lat: true, lng: true, hideAddress: true } });
  const keys = new Set(listings.map((l) => publicPoint(l)).filter((p) => !!p).map((p) => cellKey(p!.lat, p!.lng)));
  for (const key of keys) await ensureNearbyCell(key);
  console.log(`Nearby-place lookups queued or cached for ${keys.size} map cells (the worker fills about one per 20 seconds).`);

  const counts = await prisma.listing.groupBy({ by: ["mode"], _count: true });
  console.log("Seeded listings:", Object.fromEntries(counts.map((c) => [c.mode, c._count])));
  console.log(`Locations: ${await prisma.location.count()}, amenities: ${amenityIds.size}, agents: ${agentIds.size}, agencies: ${agencyIds.size}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => Promise.all([prisma.$disconnect(), appDb.$disconnect()]));
