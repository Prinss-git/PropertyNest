import "server-only";
import type { ListingStatus } from "@prisma/client";
import { db } from "./db";
import type { ListingInput } from "./listingInput";

export type Flag = { code: string; message: string };

// Price ranges outside which a human should look. [min, max] in PHP (buy = total, rent/lease = monthly).
const PRICE_BOUNDS: Record<ListingInput["mode"], [number, number]> = {
  buy: [300_000, 5_000_000_000],
  rent: [3_000, 2_000_000],
  lease: [5_000, 30_000_000],
};

// Common scam phrasing on PH listing sites: pay-before-viewing, remittance, "legit" assurances.
const SCAM_PATTERNS: [RegExp, string][] = [
  [/\b(western union|moneygram|remit(tance)?|palawan express|cebuana)\b/i, "Mentions money remittance"],
  [/\b(pay|send|deposit|reserv\w*)\b[^.]{0,40}\bbefore\b[^.]{0,20}\b(view|viewing|visit|tripping)\b/i, "Asks for payment before viewing"],
  [/\b100% legit\b|\bno scam\b|\bnot a scam\b/i, "Uses scam-reassurance wording"],
  [/\b(gcash|maya|paymaya)\b[^.]{0,40}\b(reserv\w*|deposit|downpayment|down payment)\b/i, "Asks for a reservation via e-wallet"],
];

// Contact details belong in the inquiry flow, so leads are tracked and spam-protected.
const CONTACT_PATTERN = /(\b0?9\d{2}[\s-]?\d{3}[\s-]?\d{4}\b|\+63\s?9\d{2}|[\w.+-]+@[\w-]+\.[\w.]+|\bfacebook\.com\/|\bviber\b)/i;

/** Runs the automatic checks. Any flag sends the listing to the moderation queue instead of going live. */
export async function autoCheck(input: ListingInput, opts: { posterId: string; listingId?: string; photoHashes: string[] }): Promise<Flag[]> {
  const flags: Flag[] = [];
  const [lo, hi] = PRICE_BOUNDS[input.mode];
  if (input.price < lo) flags.push({ code: "price_low", message: `Price is unusually low for ${input.mode === "buy" ? "a sale" : "a monthly rate"}.` });
  if (input.price > hi) flags.push({ code: "price_high", message: "Price is unusually high." });
  if (input.mode === "buy" && input.floorArea && ["condo", "house", "townhouse"].includes(input.type) && input.price / input.floorArea < 15_000) {
    flags.push({ code: "price_per_sqm_low", message: "Price per sqm is far below market." });
  }

  const text = `${input.title}\n${input.description}`;
  for (const [re, message] of SCAM_PATTERNS) if (re.test(text)) flags.push({ code: "scam_wording", message });
  if (CONTACT_PATTERN.test(text)) flags.push({ code: "contact_in_text", message: "Title or description contains a phone number, email, or social link." });

  if (opts.photoHashes.length) {
    const reused = await db.listingPhoto.count({
      where: {
        contentHash: { in: opts.photoHashes },
        listing: { posterId: { not: opts.posterId }, ...(opts.listingId ? { id: { not: opts.listingId } } : {}) },
      },
    });
    if (reused) flags.push({ code: "duplicate_photos", message: `${reused} photo(s) already appear on another poster's listing.` });
  }

  // First listing from a poster who isn't a verified agent gets a human look.
  const [poster, publishedBefore] = await Promise.all([
    db.user.findUnique({ where: { id: opts.posterId }, select: { agentProfile: { select: { licenseVerifiedAt: true } } } }),
    // Includes the listing being edited: once it has been approved, editing it isn't a "first listing".
    db.listing.count({ where: { posterId: opts.posterId, publishedAt: { not: null } } }),
  ]);
  if (!poster?.agentProfile?.licenseVerifiedAt && publishedBefore === 0) {
    flags.push({ code: "new_poster", message: "First listing from this account." });
  }
  return flags;
}

export function statusForFlags(flags: Flag[]): ListingStatus {
  return flags.length ? "PENDING" : "ACTIVE";
}

/** Days until a listing expires unless renewed: rentals turn over fast, sales slowly. */
export const EXPIRY_DAYS: Record<ListingInput["mode"], number> = { buy: 90, rent: 30, lease: 60 };
