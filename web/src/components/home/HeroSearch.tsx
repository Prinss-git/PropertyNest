"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MODES, MODE_KEYS, MODE_TYPES, PRICE_PRESETS, TYPES, type Mode } from "@/lib/catalog";

const HINTS: Record<Mode, React.ReactNode> = {
  buy: <><strong>Buy:</strong> prices are the total selling price. Filter by title status and financing options.</>,
  rent: <><strong>Rent:</strong> monthly rates for homes, usually 6–12 month contracts with deposit and advance.</>,
  lease: <><strong>Lease:</strong> long-term contracts (1–5+ years) for offices, retail, warehouses, and homes.</>,
};

export function HeroSearch({ locations }: { locations: string[] }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("buy");
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [price, setPrice] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const p = new URLSearchParams({ mode });
    if (q.trim()) p.set("q", q.trim());
    if (type) p.set("type", type);
    if (price) {
      const [min, max] = price.split("-").map(Number);
      if (min) p.set("min", String(min));
      if (max) p.set("max", String(max));
    }
    router.push(`/listings?${p}`);
  };

  return (
    <form className="search-box" onSubmit={submit} autoComplete="off">
      <div className="search-tabs" role="tablist">
        {MODE_KEYS.map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            className={`search-tab ${mode === m ? "active" : ""}`}
            onClick={() => {
              setMode(m);
              setType("");
              setPrice("");
            }}
          >
            {MODES[m].label}
          </button>
        ))}
      </div>
      <div className="search-fields">
        <div className="field">
          <label htmlFor="q">Location</label>
          <input className="input" id="q" list="loc-list" placeholder="City, area, or landmark (e.g. BGC, Makati)" value={q} onChange={(e) => setQ(e.target.value)} />
          <datalist id="loc-list">{locations.map((o) => <option key={o} value={o} />)}</datalist>
        </div>
        <div className="field">
          <label htmlFor="type">Property type</label>
          <select className="select" id="type" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All types</option>
            {MODE_TYPES[mode].map((t) => <option key={t} value={t}>{TYPES[t].label}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="price">Price</label>
          <select className="select" id="price" value={price} onChange={(e) => setPrice(e.target.value)}>
            <option value="">Any price</option>
            {PRICE_PRESETS[mode].map(([a, b, label]) => (
              <option key={label} value={`${a}-${b}`}>{label}{mode === "buy" ? "" : " /mo"}</option>
            ))}
          </select>
        </div>
        <button className="btn btn-primary" type="submit">Search</button>
      </div>
      <div className="search-hint">{HINTS[mode]}</div>
    </form>
  );
}
