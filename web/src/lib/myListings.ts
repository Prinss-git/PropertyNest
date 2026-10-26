import "server-only";
import { randomInt } from "node:crypto";
import { Prisma, type ListingMode, type PropertyType } from "@prisma/client";
import { revalidatePath, revalidateTag } from "next/cache";
import { HttpError, type CurrentUser } from "./auth";
import { db } from "./db";
import { distanceM, publicPoint } from "./geo";
import { ensureNearbyCell } from "./jobs";
import type { ListingInput } from "./listingInput";
import { autoCheck, EXPIRY_DAYS, statusForFlags, type Flag } from "./moderation";
import { cellKey } from "./nearby";

/** Listings that count toward a poster's limit. Plans with higher limits arrive with payments (Phase 2). */
const LIMITS: Partial<Record<CurrentUser["role"], number>> = { OWNER: 3, SEEKER: 3, AGENT: 30, AGENCY_ADMIN: 200 };
const COUNTED: Prisma.EnumListingStatusFilter = { in: ["DRAFT", "PENDING", "ACTIVE"] };

const REF_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // no 0/O/1/I, easy to read over the phone
const newRef = () => "PN-" + Array.from({ length: 6 }, () => REF_ALPHABET[randomInt(REF_ALPHABET.length)]).join("");

const slugify = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Finds the area under the city by name (ignoring case/accents) or creates it. */
async function resolveArea(cityId: string, name: string) {
  const city = await db.location.findFirst({ where: { id: cityId, level: "CITY" }, select: { id: true, slug: true, lat: true, lng: true } });
  if (!city) throw new HttpError(400, "Choose a city from the list.");
  const [match] = await db.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Location" WHERE "parentId" = ${city.id} AND level = 'AREA' AND lower(unaccent(name)) = lower(unaccent(${name})) LIMIT 1`;
  if (match) return { city, areaId: match.id };
  let slug = `${city.slug}/${slugify(name) || "area"}`;
  if (await db.location.findUnique({ where: { slug }, select: { id: true } })) slug += "-" + randomInt(1000, 9999);
  const area = await db.location.create({ data: { name, slug, level: "AREA", parentId: city.id } });
  return { city, areaId: area.id };
}

type PhotoRef = { storageKey: string; width: number | null; height: number | null; contentHash: string | null; uploadId?: string };

/** Resolves photoIds (new Upload ids or this listing's existing photo ids), keeping order and ownership. */
async function resolvePhotos(user: CurrentUser, ids: string[], listingId?: string): Promise<PhotoRef[]> {
  const [uploads, existing] = await Promise.all([
    db.upload.findMany({ where: { id: { in: ids }, userId: user.id } }),
    listingId ? db.listingPhoto.findMany({ where: { id: { in: ids }, listingId } }) : Promise.resolve([]),
  ]);
  return ids.map((id) => {
    const u = uploads.find((x) => x.id === id);
    if (u) return { storageKey: `/media/${u.storageKey}`, width: u.width, height: u.height, contentHash: u.contentHash, uploadId: u.id };
    const p = existing.find((x) => x.id === id);
    if (p) return { storageKey: p.storageKey, width: p.width, height: p.height, contentHash: p.contentHash };
    throw new HttpError(400, "One of the photos is missing. Remove it and upload it again.");
  });
}

function revalidateListing(ref: string) {
  revalidatePath(`/property/${ref}`);
  revalidatePath("/");
  revalidateTag("listings");
}

export async function saveListing(user: CurrentUser, input: ListingInput, existingRef?: string): Promise<{ ref: string; status: string; flags: Flag[] }> {
  const existing = existingRef
    ? await db.listing.findUnique({ where: { refCode: existingRef }, select: { id: true, posterId: true, status: true, publishedAt: true, mode: true } })
    : null;
  if (existingRef) {
    if (!existing) throw new HttpError(404, "Listing not found.");
    if (existing.posterId !== user.id) throw new HttpError(403, "You can only edit your own listings.");
    if (existing.status === "ARCHIVED" || existing.status === "CLOSED") throw new HttpError(409, "Closed and archived listings can't be edited. Post a new listing instead.");
  } else {
    const limit = LIMITS[user.role] ?? 0;
    const count = await db.listing.count({ where: { posterId: user.id, status: COUNTED } });
    if (count >= limit) {
      throw new HttpError(403, user.role === "AGENT"
        ? `You've reached ${limit} active listings. Close or archive one, or upgrade your plan when plans launch.`
        : `Owner accounts can have ${limit} active listings. Close one to post another.`);
    }
  }

  const { city, areaId } = await resolveArea(input.cityId, input.areaName);
  const photos = await resolvePhotos(user, input.photoIds, existing?.id);
  const flags = await autoCheck(input, {
    posterId: user.id,
    listingId: existing?.id,
    photoHashes: photos.map((p) => p.contentHash).filter((h): h is string => !!h),
  });
  // A rejected listing always goes back to a moderator after changes.
  if (existing?.status === "REJECTED") flags.push({ code: "resubmitted", message: "Resubmitted after being rejected." });
  // A pin far from the chosen city is usually a mistake (or a listing in the wrong city).
  if (city.lat != null && city.lng != null && distanceM(city.lat, city.lng, input.lat, input.lng) > 30_000) {
    flags.push({ code: "pin_far_from_city", message: "The map pin is more than 30 km from the chosen city." });
  }
  // An edit that trips a check goes back to review; a clean edit keeps a live listing live.
  const status = statusForFlags(flags);
  const now = new Date();
  const goingLive = status === "ACTIVE";
  const isResidential = ["condo", "house", "apartment", "townhouse"].includes(input.type);

  const data = {
    mode: input.mode.toUpperCase() as ListingMode,
    type: input.type.toUpperCase() as PropertyType,
    title: input.title,
    description: input.description,
    price: new Prisma.Decimal(input.price),
    bedrooms: isResidential ? input.bedrooms : null,
    bathrooms: input.type === "lot" ? null : input.bathrooms,
    floorArea: input.type === "lot" ? null : input.floorArea,
    lotArea: input.lotArea,
    parking: input.type === "lot" ? null : input.parking,
    furnishing: input.type === "lot" || input.type === "warehouse" ? "NOT_APPLICABLE" as const : input.furnishing,
    terms: input.terms as Prisma.InputJsonValue,
    cityId: city.id,
    areaId,
    address: input.address || null,
    lat: input.lat,
    lng: input.lng,
    hideAddress: !input.showExactLocation,
    status,
    moderationFlags: flags as unknown as Prisma.InputJsonValue,
    rejectionReason: null,
    ...(goingLive
      ? { publishedAt: existing?.publishedAt ?? now, expiresAt: new Date(now.getTime() + EXPIRY_DAYS[input.mode] * 864e5) }
      : {}),
  };

  const agentFields = user.role === "AGENT" ? { agentId: user.id, agencyId: user.agent?.agencyId ?? null } : {};

  const ref = await db.$transaction(async (tx) => {
    let listingId: string;
    let ref: string;
    if (existing) {
      const updated = await tx.listing.update({ where: { id: existing.id }, data: { ...data, ...agentFields }, select: { id: true, refCode: true } });
      listingId = updated.id;
      ref = updated.refCode;
      await tx.listingPhoto.deleteMany({ where: { listingId } });
      await tx.listingAmenity.deleteMany({ where: { listingId } });
    } else {
      let created: { id: string; refCode: string } | null = null;
      for (let attempt = 0; !created; attempt++) {
        try {
          created = await tx.listing.create({ data: { ...data, ...agentFields, refCode: newRef(), posterId: user.id }, select: { id: true, refCode: true } });
        } catch (e) {
          if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") || attempt > 4) throw e;
        }
      }
      listingId = created.id;
      ref = created.refCode;
    }

    await tx.listingPhoto.createMany({
      data: photos.map((p, position) => ({ listingId, position, storageKey: p.storageKey, width: p.width, height: p.height, contentHash: p.contentHash })),
    });
    if (input.amenities.length) {
      const amenities = await tx.amenity.findMany({ where: { name: { in: input.amenities } }, select: { id: true } });
      await tx.listingAmenity.createMany({ data: amenities.map((a) => ({ listingId, amenityId: a.id })) });
    }
    // Claimed uploads become listing photos; the files stay, the staging rows go.
    const claimed = photos.map((p) => p.uploadId).filter((x): x is string => !!x);
    if (claimed.length) await tx.upload.deleteMany({ where: { id: { in: claimed } } });

    // Seekers who post become owners.
    if (user.role === "SEEKER") await tx.user.update({ where: { id: user.id }, data: { role: "OWNER" } });

    await tx.auditLog.create({
      data: { actorId: user.id, action: existing ? "listing.update" : "listing.create", entityType: "Listing", entityId: listingId, data: { status, flags: flags.map((f) => f.code) } },
    });
    return ref;
  });

  revalidateListing(ref);
  // Start looking up nearby schools, hospitals, etc. now, so the map is ready when people visit.
  const point = publicPoint({ lat: input.lat, lng: input.lng, hideAddress: !input.showExactLocation, refCode: ref });
  if (point) await ensureNearbyCell(cellKey(point.lat, point.lng)).catch(() => {});
  return { ref, status, flags };
}

export async function changeListingStatus(user: CurrentUser, ref: string, action: "close" | "renew" | "archive", reason?: "SOLD" | "RENTED" | "LEASED" | "WITHDRAWN") {
  const l = await db.listing.findUnique({ where: { refCode: ref }, select: { id: true, posterId: true, status: true, mode: true } });
  if (!l) throw new HttpError(404, "Listing not found.");
  if (l.posterId !== user.id) throw new HttpError(403, "You can only change your own listings.");

  let data: Prisma.ListingUpdateInput;
  if (action === "close") {
    if (l.status !== "ACTIVE") throw new HttpError(409, "Only live listings can be marked as closed.");
    data = { status: "CLOSED", closedReason: reason ?? "WITHDRAWN" };
  } else if (action === "renew") {
    if (!["ACTIVE", "EXPIRED"].includes(l.status)) throw new HttpError(409, "Only live or expired listings can be renewed.");
    const mode = l.mode.toLowerCase() as ListingInput["mode"];
    data = { status: "ACTIVE", expiresAt: new Date(Date.now() + EXPIRY_DAYS[mode] * 864e5) };
  } else {
    data = { status: "ARCHIVED" };
  }
  await db.$transaction([
    db.listing.update({ where: { id: l.id }, data }),
    db.auditLog.create({ data: { actorId: user.id, action: `listing.${action}`, entityType: "Listing", entityId: l.id, data: reason ? { reason } : undefined } }),
  ]);
  revalidateListing(ref);
}

/** Loads a listing in the shape the edit form expects. */
export async function getListingForEdit(user: CurrentUser, ref: string) {
  const l = await db.listing.findUnique({
    where: { refCode: ref },
    include: { photos: { orderBy: { position: "asc" } }, amenities: { include: { amenity: true } }, area: true },
  });
  if (!l || l.posterId !== user.id) return null;
  return {
    ref: l.refCode,
    status: l.status,
    rejectionReason: l.rejectionReason,
    flags: (l.moderationFlags ?? []) as Flag[],
    values: {
      mode: l.mode.toLowerCase(),
      type: l.type.toLowerCase(),
      title: l.title,
      description: l.description,
      price: l.price.toNumber(),
      cityId: l.cityId,
      areaName: l.area?.name ?? "",
      address: l.address ?? "",
      bedrooms: l.bedrooms,
      bathrooms: l.bathrooms,
      floorArea: l.floorArea,
      lotArea: l.lotArea,
      parking: l.parking,
      furnishing: l.furnishing,
      amenities: l.amenities.map((a) => a.amenity.name),
      terms: l.terms as Record<string, unknown>,
      lat: l.lat,
      lng: l.lng,
      showExactLocation: !l.hideAddress,
    },
    photos: l.photos.map((p) => ({ id: p.id, url: p.storageKey })),
  };
}
export type EditableListing = NonNullable<Awaited<ReturnType<typeof getListingForEdit>>>;
