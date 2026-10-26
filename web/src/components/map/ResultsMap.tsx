"use client";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type * as Leaflet from "leaflet";
import { MODES, pesoShort } from "@/lib/catalog";
import type { ListingCard } from "@/lib/listings";
import { addBaseLayer, escapeHtml, loadLeaflet, priceIcon } from "./mapKit";

/** Search results as price pins. Uses each listing's public position (approximate unless the poster opted in). */
export function ResultsMap({ items }: { items: ListingCard[] }) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadLeaflet().then((L) => {
      if (cancelled || !el.current) return;
      mapRef.current?.remove();
      const map = L.map(el.current, { scrollWheelZoom: true });
      mapRef.current = map;
      addBaseLayer(L, map);
      const pts = items.filter((l) => l.point);
      if (!pts.length) {
        map.setView([12.88, 121.77], 6); // whole Philippines
        return;
      }
      for (const l of pts) {
        const unit = MODES[l.mode].priceUnit ? "/mo" : "";
        const m = L.marker([l.point!.lat, l.point!.lng], { icon: priceIcon(L, pesoShort(l.price) + unit) }).addTo(map);
        m.bindPopup(
          `<a class="pn-pop-card" href="/property/${encodeURIComponent(l.ref)}">` +
            (l.photo ? `<img src="${escapeHtml(l.photo)}" alt="">` : "") +
            `<strong>${escapeHtml(pesoShort(l.price))}${unit}</strong><span>${escapeHtml(l.title)}</span>` +
            `<span class="pn-pop-meta">${escapeHtml([l.area, l.city].filter(Boolean).join(", "))}${l.point!.exact ? "" : " · approx. location"}</span></a>`,
          { minWidth: 220 },
        );
      }
      map.fitBounds(L.latLngBounds(pts.map((l) => [l.point!.lat, l.point!.lng] as [number, number])), { padding: [40, 40], maxZoom: 15 });
    });
    return () => {
      cancelled = true;
    };
  }, [items]);

  useEffect(() => () => {
    mapRef.current?.remove();
    mapRef.current = null;
  }, []);

  return <div ref={el} className="results-map" aria-label="Map of search results" />;
}
