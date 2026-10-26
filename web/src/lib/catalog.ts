// Labels and options shared by server and client code. URL params use the lowercase keys.

export const MODES = {
  buy: { label: "Buy", verb: "For Sale", priceUnit: "", color: "buy" },
  rent: { label: "Rent", verb: "For Rent", priceUnit: "/month", color: "rent" },
  lease: { label: "Lease", verb: "For Lease", priceUnit: "/month", color: "lease" },
} as const;
export type Mode = keyof typeof MODES;
export const MODE_KEYS = Object.keys(MODES) as Mode[];

export const TYPES = {
  condo: { label: "Condominium", plural: "Condos", icon: "building" },
  house: { label: "House & Lot", plural: "Houses", icon: "house" },
  apartment: { label: "Apartment", plural: "Apartments", icon: "apartment" },
  townhouse: { label: "Townhouse", plural: "Townhouses", icon: "townhouse" },
  lot: { label: "Lot", plural: "Lots", icon: "lot" },
  commercial: { label: "Commercial", plural: "Commercial", icon: "store" },
  office: { label: "Office Space", plural: "Offices", icon: "office" },
  warehouse: { label: "Warehouse", plural: "Warehouses", icon: "warehouse" },
} as const;
export type PropType = keyof typeof TYPES;
export const TYPE_KEYS = Object.keys(TYPES) as PropType[];
export const RESIDENTIAL_TYPES: PropType[] = ["condo", "house", "apartment", "townhouse"];

/** Property types offered under each mode, in menu order. */
export const MODE_TYPES: Record<Mode, PropType[]> = {
  buy: ["condo", "house", "townhouse", "lot", "commercial"],
  rent: ["condo", "apartment", "house", "townhouse"],
  lease: ["office", "commercial", "warehouse", "house", "condo", "lot"],
};

export const FURNISHING = {
  FULLY_FURNISHED: "Fully Furnished",
  SEMI_FURNISHED: "Semi Furnished",
  UNFURNISHED: "Unfurnished",
  FITTED: "Fitted",
  WARM_SHELL: "Warm Shell",
  BARE_SHELL: "Bare Shell",
  NOT_APPLICABLE: "N/A",
} as const;
export type FurnishingKey = keyof typeof FURNISHING;

/** Buy presets are total price; rent and lease presets are monthly. [min, max (0 = no max), label] */
export const PRICE_PRESETS: Record<Mode, [number, number, string][]> = {
  buy: [[0, 5e6, "Under ₱5M"], [5e6, 10e6, "₱5M – ₱10M"], [10e6, 20e6, "₱10M – ₱20M"], [20e6, 50e6, "₱20M – ₱50M"], [50e6, 0, "₱50M+"]],
  rent: [[0, 20000, "Under ₱20K"], [20000, 40000, "₱20K – ₱40K"], [40000, 80000, "₱40K – ₱80K"], [80000, 150000, "₱80K – ₱150K"], [150000, 0, "₱150K+"]],
  lease: [[0, 100000, "Under ₱100K"], [100000, 250000, "₱100K – ₱250K"], [250000, 500000, "₱250K – ₱500K"], [500000, 1000000, "₱500K – ₱1M"], [1000000, 0, "₱1M+"]],
};

export function peso(n: number) {
  return "₱" + Math.round(n).toLocaleString("en-PH");
}

export function pesoShort(n: number) {
  if (n >= 1e9) return "₱" + +(n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return "₱" + +(n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return "₱" + +(n / 1e3).toFixed(1) + "K";
  return "₱" + n;
}

export function timeAgo(date: Date | string) {
  const days = Math.round((Date.now() - new Date(date).getTime()) / 864e5);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  const m = Math.round(days / 30);
  return m === 1 ? "1 month ago" : `${m} months ago`;
}

/** Amenity names offered in filters and the post form, by property group. Names match the Amenity table. */
export const AMENITY_POOLS = {
  residential: ["Swimming Pool", "Gym", "24/7 Security", "Parking", "Balcony", "Garden", "Clubhouse", "Playground", "Elevator", "Laundry Area", "Pet Friendly", "CCTV", "Function Room", "Jogging Path", "Backup Generator", "Fiber Internet Ready"],
  commercial: ["24/7 Access", "Parking", "Backup Generator", "Central Aircon", "Elevator", "CCTV", "Loading Bay", "Fire Sprinkler", "PEZA Accredited", "High Ceiling", "Fiber Internet", "Security Guard"],
  lot: ["Gated Community", "Road Access", "Electricity Available", "Water Line", "Titled", "Corner Lot", "Flat Terrain", "Near Highway"],
} as const;

export function amenityPool(mode: Mode | undefined, type: PropType | undefined): readonly string[] {
  if (type === "lot") return AMENITY_POOLS.lot;
  if (type && !RESIDENTIAL_TYPES.includes(type)) return AMENITY_POOLS.commercial;
  if (!type && mode === "lease") return AMENITY_POOLS.commercial;
  return AMENITY_POOLS.residential;
}
