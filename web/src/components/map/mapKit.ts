"use client";
// Shared Leaflet setup. Leaflet touches `window`, so it's loaded lazily inside effects, never during SSR.
import type * as Leaflet from "leaflet";

export type L = typeof Leaflet;
export const loadLeaflet = async (): Promise<L> => (await import("leaflet")).default as unknown as L;

const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';

/**
 * Base map tiles. Default: OpenStreetMap's own tiles, free and keyless but for light use only.
 * For launch set NEXT_PUBLIC_MAP_TILE_URL to a keyed provider (read at build time), e.g. Geoapify:
 *   https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}.png?apiKey=YOUR_KEY
 * and NEXT_PUBLIC_MAP_ATTRIBUTION to the attribution that provider requires.
 */
export function addBaseLayer(L: L, map: Leaflet.Map) {
  const url = process.env.NEXT_PUBLIC_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
  L.tileLayer(url, {
    maxZoom: 19,
    subdomains: "abcd",
    attribution: process.env.NEXT_PUBLIC_MAP_ATTRIBUTION || OSM_ATTRIBUTION,
  }).addTo(map);
}

export type NearbyCat = "education" | "healthcare" | "services" | "leisure" | "transport";

// 24×24 stroke icons drawn inside the pins.
const SVG: Record<NearbyCat | "home", string> = {
  education: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2 9 2 12 0v-5"/>',
  healthcare: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>',
  services: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 016 0v2"/>',
  leisure: '<path d="M12 22v-7"/><path d="M12 3l6 9H6z"/><path d="M12 9l5 7H7z"/>',
  transport: '<rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 11h14M8 21l1.5-4M16 21l-1.5-4"/><circle cx="9" cy="14" r=".6"/><circle cx="15" cy="14" r=".6"/>',
  home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
};

export const CATS: { key: NearbyCat; label: string; color: string }[] = [
  { key: "education", label: "Education", color: "#0ea5e9" },
  { key: "healthcare", label: "Healthcare", color: "#e11d48" },
  { key: "services", label: "Services", color: "#f59e0b" },
  { key: "leisure", label: "Leisure", color: "#16a34a" },
  { key: "transport", label: "Transport", color: "#475569" },
];
export const catColor = (c: NearbyCat) => CATS.find((x) => x.key === c)!.color;

export function iconSvg(name: NearbyCat | "home", size = 16, color = "#fff") {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${SVG[name]}</svg>`;
}

/** Teardrop pin with an icon, as a Leaflet divIcon (no image files, so nothing for the bundler to lose). */
export function pinIcon(L: L, opts: { color: string; icon: NearbyCat | "home"; size?: number }) {
  const s = opts.size ?? 30;
  return L.divIcon({
    className: "pn-pin",
    html: `<span class="pn-pin-body" style="--pin:${opts.color};width:${s}px;height:${s}px">${iconSvg(opts.icon, Math.round(s * 0.5))}</span>`,
    iconSize: [s, s],
    iconAnchor: [s / 2, s],
    popupAnchor: [0, -s + 4],
  });
}

/** Rounded price label used on the search results map. */
export function priceIcon(L: L, label: string, active = false) {
  return L.divIcon({
    className: "pn-price",
    html: `<span class="pn-price-body${active ? " on" : ""}">${label}</span>`,
    iconSize: undefined as unknown as [number, number],
    iconAnchor: [0, 0],
  });
}

export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
