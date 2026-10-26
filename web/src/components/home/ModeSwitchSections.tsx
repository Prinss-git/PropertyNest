"use client";
import Link from "next/link";
import { useState } from "react";
import { MODES, MODE_KEYS, MODE_TYPES, TYPES, type Mode } from "@/lib/catalog";
import type { ListingCard } from "@/lib/listings";
import { Icon } from "../Icon";
import { ListingGrid } from "../ListingCard";

function PillTabs({ value, onChange }: { value: Mode; onChange: (m: Mode) => void }) {
  return (
    <div className="pill-tabs" role="tablist">
      {MODE_KEYS.map((m) => (
        <button key={m} type="button" role="tab" aria-selected={value === m} className={value === m ? "active" : ""} onClick={() => onChange(m)}>
          {MODES[m].label}
        </button>
      ))}
    </div>
  );
}

export function TypeBrowser({ counts }: { counts: Record<string, number> }) {
  const [mode, setMode] = useState<Mode>("buy");
  return (
    <>
      <div className="section-head">
        <div>
          <h2>Browse by property type</h2>
          <p>Showing what&apos;s available to {MODES[mode].label.toLowerCase()}</p>
        </div>
        <PillTabs value={mode} onChange={setMode} />
      </div>
      <div className="type-grid">
        {MODE_TYPES[mode].map((t) => {
          const n = counts[`${mode}:${t}`] ?? 0;
          return (
            <Link key={t} className="type-card" href={`/listings?mode=${mode}&type=${t}`}>
              <div className="ti"><Icon name={TYPES[t].icon} size={22} /></div>
              <strong>{TYPES[t].plural}</strong>
              <span>{n} listing{n === 1 ? "" : "s"}</span>
            </Link>
          );
        })}
      </div>
    </>
  );
}

export function FeaturedListings({ featured }: { featured: Record<Mode, ListingCard[]> }) {
  const [mode, setMode] = useState<Mode>("buy");
  return (
    <>
      <div className="section-head">
        <div>
          <h2>Featured listings</h2>
          <p>Hand-picked properties from verified agents</p>
        </div>
        <PillTabs value={mode} onChange={setMode} />
      </div>
      <ListingGrid items={featured[mode]} />
      <div style={{ textAlign: "center", marginTop: 28 }}>
        <Link className="btn btn-outline" href={`/listings?mode=${mode}`}>
          View all properties {MODES[mode].verb.toLowerCase()}
        </Link>
      </div>
    </>
  );
}
