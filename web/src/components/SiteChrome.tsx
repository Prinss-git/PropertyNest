import Link from "next/link";
import { Suspense } from "react";
import { unstable_cache } from "next/cache";
import { getMenuCounts } from "@/lib/listings";
import { HeaderNav } from "./HeaderNav";
import { Icon } from "./Icon";

// Menu counts change slowly; one query every 5 minutes instead of one per page view.
const cachedMenuCounts = unstable_cache(getMenuCounts, ["menu-counts"], { revalidate: 300, tags: ["listings"] });

export async function SiteHeader() {
  const counts = await cachedMenuCounts();
  return (
    <header className="site-header">
      <Suspense fallback={<div className="container header-inner" />}>
        <HeaderNav counts={counts} />
      </Suspense>
    </header>
  );
}

const CITIES = ["Makati", "Taguig", "Quezon City", "Pasig", "Cebu City", "Davao City"];

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <Link href="/" className="logo">
              <Icon name="logo" size={28} /> <b style={{ fontWeight: "inherit" }}>Property<span>Nest</span></b>
            </Link>
            <p style={{ fontSize: 14, maxWidth: 320, margin: 0 }}>
              Find a place to buy, rent, or lease across the Philippines: homes, condos, offices, retail spaces, and warehouses.
            </p>
          </div>
          <div>
            <h4>Buy</h4>
            <ul>
              <li><Link href="/listings?mode=buy&type=condo">Condos for Sale</Link></li>
              <li><Link href="/listings?mode=buy&type=house">Houses for Sale</Link></li>
              <li><Link href="/listings?mode=buy&type=townhouse">Townhouses for Sale</Link></li>
              <li><Link href="/listings?mode=buy&type=lot">Lots for Sale</Link></li>
            </ul>
          </div>
          <div>
            <h4>Rent</h4>
            <ul>
              <li><Link href="/listings?mode=rent&type=condo">Condos for Rent</Link></li>
              <li><Link href="/listings?mode=rent&type=apartment">Apartments for Rent</Link></li>
              <li><Link href="/listings?mode=rent&type=house">Houses for Rent</Link></li>
              <li><Link href="/listings?mode=rent&furnishing=Fully%20Furnished">Furnished Rentals</Link></li>
            </ul>
          </div>
          <div>
            <h4>Lease</h4>
            <ul>
              <li><Link href="/listings?mode=lease&type=office">Office Space</Link></li>
              <li><Link href="/listings?mode=lease&type=commercial">Retail &amp; Commercial</Link></li>
              <li><Link href="/listings?mode=lease&type=warehouse">Warehouses</Link></li>
              <li><Link href="/listings?mode=lease&type=lot">Lots for Lease</Link></li>
            </ul>
          </div>
          <div>
            <h4>Popular Cities</h4>
            <ul>
              {CITIES.map((c) => <li key={c}><Link href={`/listings?q=${encodeURIComponent(c)}`}>{c}</Link></li>)}
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 PropertyNest. Sample listings for demonstration only.</span>
          <span><Link href="/post">List your property</Link> · <Link href="/saved">Saved listings</Link></span>
        </div>
      </div>
    </footer>
  );
}
