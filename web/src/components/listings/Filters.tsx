"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FURNISHING, MODE_TYPES, PRICE_PRESETS, RESIDENTIAL_TYPES, TYPES, TYPE_KEYS, amenityPool, type Mode, type PropType } from "@/lib/catalog";
import { listingsHref, type QueryLike } from "@/lib/searchUrl";

export function Filters({ query }: { query: QueryLike }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mobileOpen, setMobileOpen] = useState(false);
  const mode = query.mode as Mode | undefined;
  const type = query.type as PropType | undefined;
  const min = Number(query.min) || 0;
  const max = Number(query.max) || 0;
  const amenities = query.amenities ? query.amenities.split("|") : [];

  const go = (patch: QueryLike) => startTransition(() => router.push(listingsHref(query, patch), { scroll: false }));

  const types = mode ? MODE_TYPES[mode] : TYPE_KEYS;
  const residential = !type ? mode !== "lease" : RESIDENTIAL_TYPES.includes(type);
  const furnishings = Object.values(FURNISHING).filter((f) => f !== "N/A");
  const pool = amenityPool(mode, type);

  const Chips = ({ name, options }: { name: "beds" | "baths"; options: number[] }) => (
    <div className="chips">
      {[0, ...options].map((v) => (
        <button key={v} type="button" className={`chip ${(Number(query[name]) || 0) === v ? "active" : ""}`} onClick={() => go({ [name]: v ? String(v) : undefined })}>
          {v ? `${v}+` : "Any"}
        </button>
      ))}
    </div>
  );

  return (
    <>
      <button className="btn btn-outline btn-sm filter-toggle filter-open" type="button" onClick={() => setMobileOpen(true)}>Filters</button>
      <aside className={`filters ${mobileOpen ? "open" : ""}`} aria-busy={pending}>
        <h3>
          Filters
          <button type="button" onClick={() => go({ type: undefined, q: undefined, min: undefined, max: undefined, beds: undefined, baths: undefined, minArea: undefined, furnishing: undefined, term: undefined, verified: undefined, pets: undefined, amenities: undefined })}>
            Clear all
          </button>
        </h3>

        <div className="fgroup">
          <label htmlFor="f-type">Property type</label>
          <select className="select" id="f-type" value={type ?? ""} onChange={(e) => go({ type: e.target.value || undefined, amenities: undefined })}>
            <option value="">All types</option>
            {types.map((t) => <option key={t} value={t}>{TYPES[t].label}</option>)}
          </select>
        </div>

        <div className="fgroup">
          <span className="flabel">{mode === "buy" ? "Price" : mode ? "Monthly rate" : "Price (choose Buy, Rent or Lease for presets)"}</span>
          {mode && (
            <div className="chips">
              {PRICE_PRESETS[mode].map(([a, b, label]) => {
                const on = min === a && max === b;
                return (
                  <button key={label} type="button" className={`chip ${on ? "active" : ""}`}
                    onClick={() => go(on ? { min: undefined, max: undefined } : { min: a ? String(a) : undefined, max: b ? String(b) : undefined })}>
                    {label}
                  </button>
                );
              })}
            </div>
          )}
          <div className="two">
            <input key={`min-${min}`} className="input" id="f-min" type="number" min={0} placeholder="Min ₱" defaultValue={min || ""} onBlur={(e) => +e.target.value !== min && go({ min: e.target.value || undefined })} />
            <input key={`max-${max}`} className="input" id="f-max" type="number" min={0} placeholder="Max ₱" defaultValue={max || ""} onBlur={(e) => +e.target.value !== max && go({ max: e.target.value || undefined })} />
          </div>
        </div>

        {residential && (
          <>
            <div className="fgroup"><span className="flabel">Bedrooms</span><Chips name="beds" options={[1, 2, 3, 4]} /></div>
            <div className="fgroup"><span className="flabel">Bathrooms</span><Chips name="baths" options={[1, 2, 3]} /></div>
          </>
        )}

        <div className="fgroup">
          <label htmlFor="f-area">Min. floor / lot area (sqm)</label>
          <input key={`area-${query.minArea}`} className="input" id="f-area" type="number" min={0} placeholder="e.g. 50" defaultValue={query.minArea ?? ""} onBlur={(e) => e.target.value !== (query.minArea ?? "") && go({ minArea: e.target.value || undefined })} />
        </div>

        {type !== "lot" && type !== "warehouse" && (
          <div className="fgroup">
            <label htmlFor="f-furn">Furnishing</label>
            <select className="select" id="f-furn" value={query.furnishing ?? ""} onChange={(e) => go({ furnishing: e.target.value || undefined })}>
              <option value="">Any</option>
              {furnishings.map((f) => <option key={f}>{f}</option>)}
            </select>
          </div>
        )}

        {mode === "lease" && (
          <div className="fgroup">
            <label htmlFor="f-term">Max. minimum lease term</label>
            <select className="select" id="f-term" value={query.term ?? ""} onChange={(e) => go({ term: e.target.value || undefined })}>
              <option value="">Any term</option>
              {[1, 2, 3, 5].map((y) => <option key={y} value={y}>Up to {y} year{y > 1 ? "s" : ""}</option>)}
            </select>
          </div>
        )}

        <div className="fgroup">
          <label className="check"><input type="checkbox" id="f-verified" checked={query.verified === "1"} onChange={(e) => go({ verified: e.target.checked ? "1" : undefined })} /> Verified listings only</label>
          {mode === "rent" && (
            <label className="check"><input type="checkbox" id="f-pets" checked={query.pets === "1"} onChange={(e) => go({ pets: e.target.checked ? "1" : undefined })} /> Pet friendly</label>
          )}
        </div>

        <div className="fgroup">
          <span className="flabel">Amenities</span>
          <div style={{ display: "grid", gap: 6 }}>
            {pool.map((a) => (
              <label key={a} className="check">
                <input type="checkbox" checked={amenities.includes(a)}
                  onChange={(e) => {
                    const next = e.target.checked ? [...amenities, a] : amenities.filter((x) => x !== a);
                    go({ amenities: next.length ? next.join("|") : undefined });
                  }} />{" "}
                {a}
              </label>
            ))}
          </div>
        </div>
        <button type="button" className="btn btn-brand btn-block filter-toggle" style={{ marginTop: 12 }} onClick={() => setMobileOpen(false)}>Show results</button>
      </aside>
    </>
  );
}
