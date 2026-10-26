"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useFavorites } from "@/components/favorites";
import { Icon } from "@/components/Icon";
import { ListingGrid } from "@/components/ListingCard";
import type { ListingCard } from "@/lib/listings";

// Favorites are stored in this browser until accounts launch; the page asks the API for those listings.
export default function SavedPage() {
  const favs = useFavorites();
  const [items, setItems] = useState<ListingCard[] | null>(null);
  const key = favs.join(",");

  useEffect(() => {
    if (!key) {
      setItems([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/listings?ids=${encodeURIComponent(key)}&sort=newest`)
      .then((r) => r.json())
      .then((d) => !cancelled && setItems(d.items ?? []))
      .catch(() => !cancelled && setItems([]));
    return () => {
      cancelled = true;
    };
  }, [key]);

  // Keep cards visible until the refetch finishes, but drop ones just un-saved.
  const shown = items?.filter((l) => favs.includes(l.ref)) ?? null;

  return (
    <>
      <div className="page-head">
        <div className="container">
          <div className="breadcrumb"><Link href="/">Home</Link> / Saved</div>
          <h1>Saved listings</h1>
        </div>
      </div>
      <main className="container" style={{ paddingBlock: "28px 64px" }}>
        {shown === null ? (
          <p className="muted">Loading your saved listings…</p>
        ) : shown.length ? (
          <ListingGrid items={shown} />
        ) : (
          <div className="empty">
            <Icon name="heart" size={40} />
            <h3>No saved listings yet</h3>
            <p>Tap the heart on any listing to save it here.</p>
            <Link className="btn btn-outline" href="/listings">Browse listings</Link>
          </div>
        )}
      </main>
    </>
  );
}
