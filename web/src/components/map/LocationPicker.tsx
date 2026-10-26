"use client";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import { Icon } from "../Icon";
import { addBaseLayer, loadLeaflet, pinIcon, type L } from "./mapKit";

export type Pin = { lat: number; lng: number } | null;

/** Click or drag to place the property's pin. Re-centres on the chosen city until a pin is placed. */
export function LocationPicker({ value, onChange, cityCenter, exact, onExact }: {
  value: Pin;
  onChange: (p: Pin) => void;
  cityCenter: { lat: number; lng: number } | null;
  exact: boolean;
  onExact: (v: boolean) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const ref = useRef<{ L: L; map: Leaflet.Map; marker: Leaflet.Marker | null } | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState("");

  useEffect(() => {
    let cancelled = false;
    loadLeaflet().then((L) => {
      if (cancelled || !el.current || ref.current) return;
      const start = value ?? cityCenter ?? { lat: 12.88, lng: 121.77 };
      const map = L.map(el.current, { scrollWheelZoom: false }).setView([start.lat, start.lng], value ? 16 : cityCenter ? 14 : 6);
      addBaseLayer(L, map);
      ref.current = { L, map, marker: null };
      map.on("click", (e: Leaflet.LeafletMouseEvent) => onChangeRef.current({ lat: +e.latlng.lat.toFixed(6), lng: +e.latlng.lng.toFixed(6) }));
      placeMarker(value);
    });
    return () => {
      cancelled = true;
      ref.current?.map.remove();
      ref.current = null;
    };
    // The map is created once; later changes are handled by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function placeMarker(p: Pin) {
    const r = ref.current;
    if (!r) return;
    if (!p) {
      r.marker?.remove();
      r.marker = null;
      return;
    }
    if (!r.marker) {
      r.marker = r.L.marker([p.lat, p.lng], { draggable: true, icon: pinIcon(r.L, { color: "#0f5e5a", icon: "home", size: 40 }) }).addTo(r.map);
      r.marker.on("dragend", () => {
        const ll = r.marker!.getLatLng();
        onChangeRef.current({ lat: +ll.lat.toFixed(6), lng: +ll.lng.toFixed(6) });
      });
    } else {
      r.marker.setLatLng([p.lat, p.lng]);
    }
  }

  useEffect(() => placeMarker(value), [value]);

  // Changing the city moves the view (not the pin) so the poster can place it there.
  useEffect(() => {
    if (cityCenter && ref.current && !value) ref.current.map.setView([cityCenter.lat, cityCenter.lng], 14);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityCenter?.lat, cityCenter?.lng]);

  function useMyLocation() {
    if (!navigator.geolocation) return setGeoError("Your browser can't share its location.");
    setLocating(true);
    setGeoError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const p = { lat: +pos.coords.latitude.toFixed(6), lng: +pos.coords.longitude.toFixed(6) };
        onChange(p);
        ref.current?.map.setView([p.lat, p.lng], 17);
      },
      () => {
        setLocating(false);
        setGeoError("Couldn't get your location. Allow location access, or click the map instead.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <div className="picker">
      <div className="picker-bar">
        <span className="fine">{value ? "Drag the pin to adjust, or click elsewhere on the map." : "Click the map where the property is."}</span>
        <button type="button" className="btn btn-outline btn-sm" onClick={useMyLocation} disabled={locating}>
          <Icon name="target" size={16} /> {locating ? "Locating…" : "Use my current location"}
        </button>
      </div>
      <div ref={el} className="picker-map" aria-label="Map: click to place the property" />
      {geoError && <p className="form-error">{geoError}</p>}
      <label className="check">
        <input type="checkbox" checked={exact} onChange={(e) => onExact(e.target.checked)} />
        Show the exact location on the listing
      </label>
      <span className="fine">{exact ? "Buyers and tenants see the exact pin and can get directions." : "Visitors see a shaded area of about 400 m instead of the exact spot. Recommended for homes."}</span>
    </div>
  );
}
