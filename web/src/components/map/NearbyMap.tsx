"use client";
import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import { Icon } from "../Icon";
import { CATS, addBaseLayer, catColor, escapeHtml, iconSvg, loadLeaflet, pinIcon, type L, type NearbyCat } from "./mapKit";

type Place = { name: string; cat: NearbyCat; type: string; lat: number; lng: number; distance: number; walk: number };
type Point = { lat: number; lng: number; exact: boolean };
type Data = { status: "ready" | "pending" | "failed" | "none"; radius: number; places: Place[] };

const APPROX_RADIUS_M = 400;
const POLL_MS = 4000;
const MAX_POLLS = 30;

/** "What's nearby": map with category pins, 1 km circle, and the closest places with walking times. */
export function NearbyMap({ refCode, point, address }: { refCode: string; point: Point; address: string }) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<{ L: L; map: Leaflet.Map; layer: Leaflet.LayerGroup; markers: Map<string, Leaflet.Marker> } | null>(null);
  const [data, setData] = useState<Data | null>(null);
  const [cat, setCat] = useState<NearbyCat | "all">("all");

  // Load nearby places, polling while the worker is still fetching them.
  useEffect(() => {
    let polls = 0, timer: ReturnType<typeof setTimeout>, alive = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/nearby?ref=${encodeURIComponent(refCode)}`);
        const d = (await res.json()) as Data;
        if (!alive) return;
        setData(d);
        if (d.status === "pending" && ++polls < MAX_POLLS) timer = setTimeout(load, POLL_MS);
      } catch {
        if (alive) setData({ status: "failed", radius: 1000, places: [] });
      }
    };
    load();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [refCode]);

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    loadLeaflet().then((L) => {
      if (cancelled || !el.current || mapRef.current) return;
      const map = L.map(el.current, { scrollWheelZoom: false, zoomControl: false }).setView([point.lat, point.lng], 15);
      L.control.zoom({ position: "topright" }).addTo(map); // top-left is taken by the places panel
      addBaseLayer(L, map);
      L.circle([point.lat, point.lng], { radius: 1000, color: "#3b6fd8", weight: 1.5, fillColor: "#3b6fd8", fillOpacity: 0.08, interactive: false }).addTo(map);
      if (point.exact) {
        L.marker([point.lat, point.lng], { icon: pinIcon(L, { color: "#0f5e5a", icon: "home", size: 40 }), zIndexOffset: 1000 }).addTo(map).bindTooltip("This property");
      } else {
        L.circle([point.lat, point.lng], { radius: APPROX_RADIUS_M, color: "#0f5e5a", weight: 2, dashArray: "6 6", fillColor: "#0f5e5a", fillOpacity: 0.18 })
          .addTo(map).bindTooltip("Approximate location");
      }
      const layer = L.layerGroup().addTo(map);
      mapRef.current = { L, map, layer, markers: new Map() };
      setData((d) => (d ? { ...d } : d)); // re-run the marker effect if data arrived before the map
    });
    return () => {
      cancelled = true;
      mapRef.current?.map.remove();
      mapRef.current = null;
    };
  }, [point.lat, point.lng, point.exact]);

  const visible = useMemo(() => (data?.places ?? []).filter((p) => cat === "all" || p.cat === cat), [data, cat]);

  // Draw place pins for the selected category.
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    m.layer.clearLayers();
    m.markers.clear();
    for (const p of visible) {
      const marker = m.L.marker([p.lat, p.lng], { icon: pinIcon(m.L, { color: catColor(p.cat), icon: p.cat, size: 28 }) })
        .bindPopup(`<strong>${escapeHtml(p.name)}</strong><br><span class="pn-pop-meta">${escapeHtml(p.type)} · ${p.walk} min walk (${p.distance < 1000 ? p.distance + " m" : (p.distance / 1000).toFixed(1) + " km"})</span>`);
      marker.addTo(m.layer);
      m.markers.set(`${p.name}|${p.lat}|${p.lng}`, marker);
    }
  }, [visible]);

  const focus = (p: Place) => {
    const m = mapRef.current;
    if (!m) return;
    m.map.flyTo([p.lat, p.lng], 16, { duration: 0.6 });
    m.markers.get(`${p.name}|${p.lat}|${p.lng}`)?.openPopup();
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const p of data?.places ?? []) c[p.cat] = (c[p.cat] ?? 0) + 1;
    return c;
  }, [data]);
  const closest = visible.slice(0, 4);
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lng}`;

  return (
    <div className="nearby">
      <p className="nearby-address"><Icon name="pin" size={18} /> {address}</p>
      <div className="nearby-chips" role="tablist" aria-label="Place categories">
        <button type="button" role="tab" aria-selected={cat === "all"} className={cat === "all" ? "on" : ""} onClick={() => setCat("all")}>All</button>
        {CATS.map((c) => (
          <button key={c.key} type="button" role="tab" aria-selected={cat === c.key} className={cat === c.key ? "on" : ""} onClick={() => setCat(c.key)}>
            {c.label}{counts[c.key] ? <span className="n">{counts[c.key]}</span> : null}
          </button>
        ))}
      </div>
      <div className="nearby-frame">
        <div ref={el} className="nearby-map" aria-label="Map of the property and nearby places" />
        <div className="nearby-panel">
          {!data || data.status === "pending" ? (
            <p className="nearby-note"><span className="spinner" aria-hidden="true" /> Finding schools, hospitals and transport nearby…</p>
          ) : data.status === "failed" ? (
            <p className="nearby-note">Nearby places aren&apos;t available right now.</p>
          ) : closest.length === 0 ? (
            <p className="nearby-note">No {cat === "all" ? "places" : CATS.find((c) => c.key === cat)!.label.toLowerCase() + " places"} found within 1 km.</p>
          ) : (
            <ul>
              {closest.map((p) => (
                <li key={`${p.name}${p.lat}`}>
                  <button type="button" onClick={() => focus(p)}>
                    <span className="nearby-ico" style={{ color: catColor(p.cat) }} dangerouslySetInnerHTML={{ __html: iconSvg(p.cat, 18, "currentColor") }} />
                    <span className="nearby-name">{p.name}</span>
                    <span className="nearby-walk"><Icon name="walk" size={14} /> {p.walk} min</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <p className="nearby-foot">
        {point.exact
          ? <a href={directions} target="_blank" rel="noopener noreferrer">Get directions in Google Maps ↗</a>
          : <>The shaded circle shows the approximate location. The exact address is shared after you inquire.</>}
        <span className="muted"> · Walking times are estimates.</span>
      </p>
    </div>
  );
}
