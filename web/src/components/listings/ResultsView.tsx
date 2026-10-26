"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ListingCard } from "@/lib/listings";
import { listingsHref, type QueryLike } from "@/lib/searchUrl";
import { Icon } from "../Icon";
import { ListingGrid } from "../ListingCard";
import { ResultsMap } from "../map/ResultsMap";

type View = "grid" | "list" | "map";

/** Sort dropdown, grid/list toggle (remembered per browser) and the result cards. */
export function ResultsView({ query, items, total }: { query: QueryLike; items: ListingCard[]; total: number }) {
  const router = useRouter();
  const [view, setView] = useState<View>("grid");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("pn_view");
      if (saved === "list" || saved === "map") setView(saved);
    } catch { /* storage blocked */ }
  }, []);
  const choose = (v: View) => {
    setView(v);
    try { localStorage.setItem("pn_view", v); } catch { /* storage blocked */ }
  };

  return (
    <>
      <div className="results-bar">
        <div className="count"><strong>{total}</strong> <span className="muted">{total === 1 ? "property found" : "properties found"}</span></div>
        <div className="results-tools">
          <select className="select" id="sort" style={{ width: "auto" }} value={query.sort ?? "relevance"}
            onChange={(e) => router.push(listingsHref(query, { sort: e.target.value }), { scroll: false })}>
            <option value="relevance">Sort: Featured</option>
            <option value="newest">Newest first</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
            <option value="area-desc">Largest area</option>
          </select>
          <div className="view-toggle">
            <button type="button" className={view === "grid" ? "active" : ""} aria-label="Grid view" onClick={() => choose("grid")}><Icon name="grid" /></button>
            <button type="button" className={view === "list" ? "active" : ""} aria-label="List view" onClick={() => choose("list")}><Icon name="list" /></button>
            <button type="button" className={view === "map" ? "active" : ""} aria-label="Map view" onClick={() => choose("map")}><Icon name="map" /></button>
          </div>
        </div>
      </div>
      {view === "map" && <ResultsMap items={items} />}
      <ListingGrid items={items} list={view === "list"} />
    </>
  );
}
