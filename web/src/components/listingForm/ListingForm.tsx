"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { FURNISHING, MODES, MODE_TYPES, RESIDENTIAL_TYPES, TYPES, amenityPool, type FurnishingKey, type Mode, type PropType } from "@/lib/catalog";
import { DEFAULT_TERMS, type FormTerms, type FormValues } from "@/lib/listingDefaults";
import { FINANCING, TITLE_STATUSES } from "@/lib/listingInput";
import { PhotoUploader, type Photo } from "./PhotoUploader";

export type City = { id: string; name: string; province: string; areas: string[] };

const MODE_PICK: Record<Mode, [string, string]> = {
  buy: ["Sell", "Listed under Buy, with a total selling price"],
  rent: ["Rent out", "Monthly rental for homes and condos"],
  lease: ["Lease", "Long-term contract, 1 year or more"],
};

const furnishingOptions = (type: PropType): FurnishingKey[] =>
  RESIDENTIAL_TYPES.includes(type) ? ["FULLY_FURNISHED", "SEMI_FURNISHED", "UNFURNISHED"]
  : type === "office" || type === "commercial" ? ["FITTED", "WARM_SHELL", "BARE_SHELL"]
  : ["NOT_APPLICABLE"];

export function ListingForm({ cities, initial, initialPhotos = [], editRef }: { cities: City[]; initial: FormValues; initialPhotos?: Photo[]; editRef?: string }) {
  const router = useRouter();
  const [v, setV] = useState<FormValues>(initial);
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);

  const set = <K extends keyof FormValues>(k: K, val: FormValues[K]) => setV((p) => ({ ...p, [k]: val }));
  const setTerm = (k: string, val: FormTerms[string]) => setV((p) => ({ ...p, terms: { ...p.terms, [k]: val } }));
  const residential = RESIDENTIAL_TYPES.includes(v.type);
  const isLot = v.type === "lot";
  const pool = amenityPool(v.mode, v.type);
  const city = useMemo(() => cities.find((c) => c.id === v.cityId), [cities, v.cityId]);

  function chooseMode(mode: Mode) {
    const type = MODE_TYPES[mode].includes(v.type) ? v.type : MODE_TYPES[mode][0];
    setV((p) => ({ ...p, mode, type, terms: DEFAULT_TERMS[mode], furnishing: furnishingOptions(type)[0] }));
  }
  function chooseType(type: PropType) {
    setV((p) => ({ ...p, type, furnishing: furnishingOptions(type)[0], amenities: p.amenities.filter((a) => amenityPool(p.mode, type).includes(a)) }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const payload = {
      ...v,
      price: v.price,
      bedrooms: residential ? v.bedrooms : null,
      bathrooms: isLot ? null : v.bathrooms,
      floorArea: isLot ? null : v.floorArea,
      lotArea: v.lotArea,
      parking: isLot ? null : v.parking,
      photoIds: photos.map((p) => p.id),
    };
    try {
      const res = await fetch(editRef ? `/api/my/listings/${editRef}` : "/api/my/listings", {
        method: editRef ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError({ message: data.error ?? "Couldn't save the listing.", field: data.field });
        if (data.field) document.querySelector<HTMLElement>(`[data-field="${data.field.split(".")[0]}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      router.push(`/account?saved=${data.ref}&status=${data.status}`);
      router.refresh();
    } catch {
      setError({ message: "Couldn't reach the server. Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  }

  const err = (field: string) => error?.field?.split(".")[0] === field || error?.field === field ? <p className="form-error">{error!.message}</p> : null;
  const t = v.terms;

  return (
    <form className="form-card" onSubmit={submit} autoComplete="off" noValidate>
      {!editRef && (
        <div className="form-section">
          <h2>1. What do you want to do?</h2>
          <div className="mode-picker" role="radiogroup">
            {(Object.keys(MODES) as Mode[]).map((m) => (
              <label key={m} className={v.mode === m ? "on" : ""}>
                <input type="radio" name="mode" checked={v.mode === m} onChange={() => chooseMode(m)} />
                <strong>{MODE_PICK[m][0]}</strong><span>{MODE_PICK[m][1]}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="form-section">
        <h2>{editRef ? "Property basics" : "2. Property basics"}</h2>
        <div className="form-grid">
          <div className="field" data-field="type"><label htmlFor="p-type">Property type</label>
            <select className="select" id="p-type" value={v.type} onChange={(e) => chooseType(e.target.value as PropType)}>
              {MODE_TYPES[v.mode].map((x) => <option key={x} value={x}>{TYPES[x].label}</option>)}
            </select>{err("type")}</div>
          <div className="field span2" data-field="title"><label htmlFor="p-title">Listing title</label>
            <input className="input" id="p-title" value={v.title} maxLength={100} onChange={(e) => set("title", e.target.value)} placeholder="e.g. 2BR corner unit with city view" />{err("title")}</div>

          <div className="field" data-field="cityId"><label htmlFor="p-city">City</label>
            <select className="select" id="p-city" value={v.cityId} onChange={(e) => set("cityId", e.target.value)}>
              {cities.map((c) => <option key={c.id} value={c.id}>{c.name}, {c.province}</option>)}
            </select>{err("cityId")}</div>
          <div className="field span2" data-field="areaName"><label htmlFor="p-area">Area / barangay / building</label>
            <input className="input" id="p-area" list="area-list" value={v.areaName} onChange={(e) => set("areaName", e.target.value)} placeholder="e.g. Salcedo Village" />
            <datalist id="area-list">{city?.areas.map((a) => <option key={a} value={a} />)}</datalist>{err("areaName")}</div>

          <div className="field span3" data-field="address"><label htmlFor="p-address">Street address (optional, shown only after an inquiry)</label>
            <input className="input" id="p-address" value={v.address} maxLength={200} onChange={(e) => set("address", e.target.value)} /></div>

          <div className="field" data-field="price"><label htmlFor="p-price">{v.mode === "buy" ? "Selling price (₱)" : v.mode === "rent" ? "Monthly rent (₱)" : "Monthly lease rate (₱)"}</label>
            <input className="input" id="p-price" type="number" min={1} inputMode="numeric" value={v.price} onChange={(e) => set("price", e.target.value)} />{err("price")}</div>
          {residential && <div className="field" data-field="bedrooms"><label htmlFor="p-beds">Bedrooms (0 = studio)</label>
            <input className="input" id="p-beds" type="number" min={0} value={v.bedrooms} onChange={(e) => set("bedrooms", e.target.value)} />{err("bedrooms")}</div>}
          {!isLot && <div className="field" data-field="bathrooms"><label htmlFor="p-baths">Bathrooms</label>
            <input className="input" id="p-baths" type="number" min={0} value={v.bathrooms} onChange={(e) => set("bathrooms", e.target.value)} />{err("bathrooms")}</div>}
          {!isLot && <div className="field" data-field="floorArea"><label htmlFor="p-floor">Floor area (sqm)</label>
            <input className="input" id="p-floor" type="number" min={0} value={v.floorArea} onChange={(e) => set("floorArea", e.target.value)} />{err("floorArea")}</div>}
          <div className="field" data-field="lotArea"><label htmlFor="p-land">Lot area (sqm){isLot ? "" : ", optional"}</label>
            <input className="input" id="p-land" type="number" min={0} value={v.lotArea} onChange={(e) => set("lotArea", e.target.value)} />{err("lotArea")}</div>
          {!isLot && <div className="field" data-field="parking"><label htmlFor="p-parking">Parking slots</label>
            <input className="input" id="p-parking" type="number" min={0} value={v.parking} onChange={(e) => set("parking", e.target.value)} /></div>}
          {furnishingOptions(v.type)[0] !== "NOT_APPLICABLE" && <div className="field"><label htmlFor="p-furn">Furnishing</label>
            <select className="select" id="p-furn" value={v.furnishing} onChange={(e) => set("furnishing", e.target.value as FurnishingKey)}>
              {furnishingOptions(v.type).map((f) => <option key={f} value={f}>{FURNISHING[f]}</option>)}
            </select></div>}
        </div>
      </div>

      <div className="form-section" data-field="terms">
        <h2>{editRef ? "Terms" : "3. Terms"}</h2>
        {v.mode === "buy" && (
          <div className="form-grid">
            <div className="field"><label htmlFor="p-ts">Title status</label>
              <select className="select" id="p-ts" value={String(t.titleStatus)} onChange={(e) => setTerm("titleStatus", e.target.value)}>
                {TITLE_STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select></div>
            <div className="field span2"><span className="flabel">Payment options accepted</span>
              <div className="chips">
                {FINANCING.map((f) => {
                  const list = (t.financing as string[]) ?? [];
                  return (
                    <label key={f} className="check"><input type="checkbox" checked={list.includes(f)}
                      onChange={(e) => setTerm("financing", e.target.checked ? [...list, f] : list.filter((x) => x !== f))} /> {f}</label>
                  );
                })}
              </div></div>
          </div>
        )}
        {v.mode === "rent" && (
          <div className="form-grid">
            <div className="field"><label htmlFor="p-rdep">Security deposit (months)</label><input className="input" id="p-rdep" type="number" min={0} value={String(t.depositMonths)} onChange={(e) => setTerm("depositMonths", e.target.value)} /></div>
            <div className="field"><label htmlFor="p-radv">Advance rent (months)</label><input className="input" id="p-radv" type="number" min={0} value={String(t.advanceMonths)} onChange={(e) => setTerm("advanceMonths", e.target.value)} /></div>
            <div className="field"><label htmlFor="p-stay">Minimum stay (months)</label><input className="input" id="p-stay" type="number" min={1} value={String(t.minStayMonths)} onChange={(e) => setTerm("minStayMonths", e.target.value)} /></div>
            <label className="check span3"><input type="checkbox" checked={!!t.petFriendly} onChange={(e) => setTerm("petFriendly", e.target.checked)} /> Pets allowed</label>
          </div>
        )}
        {v.mode === "lease" && (
          <div className="form-grid">
            <div className="field"><label htmlFor="p-term">Minimum lease term (years)</label><input className="input" id="p-term" type="number" min={1} value={String(t.minTermYears)} onChange={(e) => setTerm("minTermYears", e.target.value)} /></div>
            <div className="field"><label htmlFor="p-esc">Annual escalation (%)</label><input className="input" id="p-esc" type="number" min={0} step={0.5} value={String(t.escalationPct)} onChange={(e) => setTerm("escalationPct", e.target.value)} /></div>
            <div className="field"><label htmlFor="p-cusa">CUSA (₱ per sqm, optional)</label><input className="input" id="p-cusa" type="number" min={0} value={String(t.cusaPerSqm ?? "")} onChange={(e) => setTerm("cusaPerSqm", e.target.value)} /></div>
            <div className="field"><label htmlFor="p-ldep">Deposit (months)</label><input className="input" id="p-ldep" type="number" min={0} value={String(t.depositMonths)} onChange={(e) => setTerm("depositMonths", e.target.value)} /></div>
            <div className="field"><label htmlFor="p-ladv">Advance (months)</label><input className="input" id="p-ladv" type="number" min={0} value={String(t.advanceMonths)} onChange={(e) => setTerm("advanceMonths", e.target.value)} /></div>
          </div>
        )}
        {err("terms")}
      </div>

      <div className="form-section">
        <h2>{editRef ? "Amenities" : "4. Amenities"}</h2>
        <div className="amen-checks">
          {pool.map((a) => (
            <label key={a} className="check"><input type="checkbox" checked={v.amenities.includes(a)}
              onChange={(e) => set("amenities", e.target.checked ? [...v.amenities, a] : v.amenities.filter((x) => x !== a))} /> {a}</label>
          ))}
        </div>
      </div>

      <div className="form-section">
        <h2>{editRef ? "Description & photos" : "5. Description & photos"}</h2>
        <div className="field" data-field="description">
          <label htmlFor="p-desc">Description</label>
          <textarea className="textarea" id="p-desc" rows={6} maxLength={5000} value={v.description} onChange={(e) => set("description", e.target.value)}
            placeholder="Describe the property, nearby landmarks, and what makes it stand out. Don't include phone numbers or emails; buyers contact you through PropertyNest." />
          <span className="fine">{v.description.trim().length}/50 characters minimum</span>
          {err("description")}
        </div>
        <div data-field="photoIds">
          <PhotoUploader photos={photos} onChange={setPhotos} />
          {err("photoIds")}
        </div>
      </div>

      {error && !error.field && <p className="form-error" role="alert">{error.message}</p>}
      {error?.field && <p className="form-error" role="alert">Check the highlighted field: {error.message}</p>}
      <div className="form-actions">
        <button type="button" className="btn btn-outline" onClick={() => router.back()}>Cancel</button>
        <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? "Saving…" : editRef ? "Save changes" : "Publish listing"}</button>
      </div>
      <p className="fine" style={{ textAlign: "right" }}>Listings are checked automatically. Some go to a quick human review before going live.</p>
    </form>
  );
}
