// Validation for creating / editing a listing. Shared by the form (client) and the API (server).
import { z } from "zod";
import { inPhilippinesBox } from "./phBounds";
import { AMENITY_POOLS, FURNISHING, MODE_TYPES, type FurnishingKey, type Mode, type PropType } from "./catalog";

export const TITLE_STATUSES = ["Clean Title", "Pre-selling", "RFO (Ready for Occupancy)"] as const;
export const FINANCING = ["Cash", "Bank Financing", "Pag-IBIG", "In-house Financing"] as const;

const int = (min: number, max: number, label: string) =>
  z.coerce.number({ invalid_type_error: `${label} must be a number.` }).int(`${label} must be a whole number.`).min(min, `${label} must be at least ${min}.`).max(max, `${label} can't be more than ${max.toLocaleString()}.`);
const optInt = (min: number, max: number, label: string) =>
  z.preprocess((v) => (v === "" || v === null || v === undefined ? null : v), int(min, max, label).nullable());

export const buyTerms = z.object({
  titleStatus: z.enum(TITLE_STATUSES),
  financing: z.array(z.enum(FINANCING)).min(1, "Choose at least one way buyers can pay."),
});
export const rentTerms = z.object({
  depositMonths: int(0, 12, "Deposit"),
  advanceMonths: int(0, 12, "Advance"),
  minStayMonths: int(1, 60, "Minimum stay"),
  petFriendly: z.boolean(),
});
export const leaseTerms = z.object({
  minTermYears: int(1, 25, "Minimum lease term"),
  escalationPct: z.coerce.number().min(0).max(30, "Escalation can't be more than 30% a year."),
  depositMonths: int(0, 24, "Deposit"),
  advanceMonths: int(0, 24, "Advance"),
  cusaPerSqm: z.preprocess((v) => (v === "" || v === null || v === undefined ? null : v), z.coerce.number().min(0).max(5000).nullable()),
});

const base = z.object({
  type: z.enum(["condo", "house", "apartment", "townhouse", "lot", "commercial", "office", "warehouse"]),
  title: z.string().trim().min(10, "Make the title at least 10 characters.").max(100, "Keep the title under 100 characters."),
  description: z.string().trim().min(50, "Describe the property in at least 50 characters.").max(5000),
  price: z.coerce.number({ invalid_type_error: "Enter a price." }).positive("Enter a price.").max(50_000_000_000),
  cityId: z.string().min(1, "Choose a city."),
  areaName: z.string().trim().min(2, "Enter the area, barangay, or building.").max(80),
  address: z.string().trim().max(200).optional().or(z.literal("")),
  bedrooms: optInt(0, 50, "Bedrooms"),
  bathrooms: optInt(0, 50, "Bathrooms"),
  floorArea: optInt(0, 1_000_000, "Floor area"),
  lotArea: optInt(0, 10_000_000, "Lot area"),
  parking: optInt(0, 500, "Parking"),
  furnishing: z.enum(Object.keys(FURNISHING) as [FurnishingKey, ...FurnishingKey[]]),
  amenities: z.array(z.string().max(60)).max(30),
  photoIds: z.array(z.string().min(1)).min(3, "Add at least 3 photos.").max(20, "Add up to 20 photos."),
  lat: z.number({ required_error: "Place the pin on the map.", invalid_type_error: "Place the pin on the map." }),
  lng: z.number({ required_error: "Place the pin on the map.", invalid_type_error: "Place the pin on the map." }),
  showExactLocation: z.boolean().default(false),
});

export const listingInputSchema = z
  .discriminatedUnion("mode", [
    base.extend({ mode: z.literal("buy"), terms: buyTerms }),
    base.extend({ mode: z.literal("rent"), terms: rentTerms }),
    base.extend({ mode: z.literal("lease"), terms: leaseTerms }),
  ])
  .superRefine((d, ctx) => {
    if (!MODE_TYPES[d.mode as Mode].includes(d.type as PropType)) {
      ctx.addIssue({ code: "custom", path: ["type"], message: "That property type isn't available for this listing type." });
    }
    const allowed = new Set<string>([...AMENITY_POOLS.residential, ...AMENITY_POOLS.commercial, ...AMENITY_POOLS.lot]);
    if (d.amenities.some((a) => !allowed.has(a))) ctx.addIssue({ code: "custom", path: ["amenities"], message: "Unknown amenity." });
    if (!inPhilippinesBox(d.lat, d.lng)) ctx.addIssue({ code: "custom", path: ["lat"], message: "The pin must be in the Philippines." });
    if (d.type === "lot" ? !d.lotArea : !d.floorArea) {
      ctx.addIssue({ code: "custom", path: [d.type === "lot" ? "lotArea" : "floorArea"], message: d.type === "lot" ? "Enter the lot area." : "Enter the floor area." });
    }
  });

export type ListingInput = z.infer<typeof listingInputSchema>;
