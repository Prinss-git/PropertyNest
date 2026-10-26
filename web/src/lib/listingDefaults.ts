// Starting values for the listing form. Plain module (not "use client") so server pages can build them.
import type { FurnishingKey, Mode, PropType } from "./catalog";

export type FormTerms = Record<string, string | number | boolean | string[] | null>;
export type FormValues = {
  mode: Mode; type: PropType; title: string; description: string; price: string;
  cityId: string; areaName: string; address: string;
  bedrooms: string; bathrooms: string; floorArea: string; lotArea: string; parking: string;
  furnishing: FurnishingKey; amenities: string[]; terms: FormTerms;
  lat: number | null; lng: number | null; showExactLocation: boolean;
};

export const DEFAULT_TERMS: Record<Mode, FormTerms> = {
  buy: { titleStatus: "Clean Title", financing: ["Cash", "Bank Financing"] },
  rent: { depositMonths: 2, advanceMonths: 1, minStayMonths: 12, petFriendly: false },
  lease: { minTermYears: 3, escalationPct: 5, depositMonths: 3, advanceMonths: 3, cusaPerSqm: "" },
};

export function emptyValues(cityId: string): FormValues {
  return {
    mode: "buy", type: "condo", title: "", description: "", price: "", cityId, areaName: "", address: "",
    bedrooms: "1", bathrooms: "1", floorArea: "", lotArea: "", parking: "0", furnishing: "UNFURNISHED", amenities: [], terms: DEFAULT_TERMS.buy,
    lat: null, lng: null, showExactLocation: false,
  };
}
