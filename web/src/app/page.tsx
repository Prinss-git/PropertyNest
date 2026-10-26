import Link from "next/link";
import { FeaturedListings, TypeBrowser } from "@/components/home/ModeSwitchSections";
import { HeroSearch } from "@/components/home/HeroSearch";
import { LoanCalculator } from "@/components/home/LoanCalculator";
import { Icon } from "@/components/Icon";
import { ListingGrid } from "@/components/ListingCard";
import { db } from "@/lib/db";
import { getHomeData } from "@/lib/listings";

// Rebuilt at most once a minute; every visitor in between gets the cached page.
export const revalidate = 60;

const MODE_CARDS = [
  { mode: "buy", icon: "key", color: "var(--buy)", title: "Buy", text: "Own a home, condo, or lot. See total prices, title status, and financing options.",
    points: ["Clean title & RFO filters", "Bank, Pag-IBIG & in-house financing", "Built-in loan calculator"] },
  { mode: "rent", icon: "house", color: "var(--rent)", title: "Rent", text: "Monthly rentals for condos, apartments, and houses, from short stays to yearly contracts.",
    points: ["Monthly rates with deposit & advance shown", "Furnished / pet-friendly filters", "6–12 month minimum stays"] },
  { mode: "lease", icon: "office", color: "var(--lease)", title: "Lease", text: "Long-term leases for businesses and families: offices, retail, warehouses, and homes.",
    points: ["Lease term & annual escalation shown", "CUSA and fit-out details", "PEZA-accredited spaces"] },
];

const CITY_PHOTOS: Record<string, string> = {
  Taguig: "1555217851-6141535bd771",
  Makati: "1518548419970-58e3b4079ab2",
  "Cebu City": "1570789210967-2cac24afeb00",
  "Quezon City": "1519501025264-65ba15a82390",
  Pasig: "1480714378408-67cf0d13bc1b",
  "Davao City": "1506905925346-21bda4d32df4",
  Baguio: "1464822759023-fed622ff2c3b",
};

export default async function HomePage() {
  const [data, locs] = await Promise.all([
    getHomeData(),
    db.location.findMany({ where: { level: { in: ["CITY", "PROVINCE", "REGION"] } }, select: { name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <main>
      <section className="hero">
        <div className="container">
          <h1>Find your next place.<br />Buy, rent, or lease.</h1>
          <p className="lead">Homes, condos, offices, retail spaces, and warehouses from verified agents and owners across the Philippines.</p>
          <HeroSearch locations={locs.map((l) => l.name)} />
          <div className="hero-stats">
            <div><strong>{data.counts.buy ?? 0}</strong><span>Properties for sale</span></div>
            <div><strong>{data.counts.rent ?? 0}</strong><span>Homes for rent</span></div>
            <div><strong>{data.counts.lease ?? 0}</strong><span>Spaces for lease</span></div>
            <div><strong>{Object.keys(data.cityCounts).length}</strong><span>Cities covered</span></div>
          </div>
        </div>
      </section>

      <section className="block">
        <div className="container">
          <div className="section-head">
            <div>
              <h2>Buy, rent, or lease: pick what fits</h2>
              <p>Each option has its own price format, terms, and filters.</p>
            </div>
          </div>
          <div className="mode-grid">
            {MODE_CARDS.map((c) => (
              <div key={c.mode} className="mode-card">
                <div className="mode-icon" style={{ background: c.color }}><Icon name={c.icon} size={24} /></div>
                <h3>{c.title}</h3>
                <p>{c.text}</p>
                <ul>{c.points.map((p) => <li key={p}>{p}</li>)}</ul>
                <Link className="link-more" href={`/listings?mode=${c.mode}`}>Browse {c.title.toLowerCase()} listings →</Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="block soft">
        <div className="container"><TypeBrowser counts={data.counts} /></div>
      </section>

      <section className="block">
        <div className="container"><FeaturedListings featured={data.featured} /></div>
      </section>

      <section className="block soft" id="locations">
        <div className="container">
          <div className="section-head">
            <div>
              <h2>Popular locations</h2>
              <p>Where people are searching right now</p>
            </div>
          </div>
          <div className="loc-grid">
            {Object.entries(CITY_PHOTOS).map(([city, photo], i) => {
              const c = data.cityCounts[city];
              return (
                <Link key={city} className={`loc-card ${i === 0 ? "big" : ""}`} href={`/listings?q=${encodeURIComponent(city)}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/img/${photo}.jpg`} alt={city} loading="lazy" />
                  <div className="ov"><strong>{city}</strong><span>{c?.province} · {c?.count ?? 0} listings</span></div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="block">
        <div className="container">
          <div className="section-head">
            <div>
              <h2>Newly listed</h2>
              <p>Fresh listings across all three categories</p>
            </div>
            <Link href="/listings?sort=newest" className="link-more">See all →</Link>
          </div>
          <ListingGrid items={data.latest} />
        </div>
      </section>

      <section className="block soft" id="calculator">
        <div className="container">
          <div className="section-head">
            <div>
              <h2>Home loan calculator</h2>
              <p>Estimate your monthly amortization before you buy</p>
            </div>
          </div>
          <LoanCalculator />
        </div>
      </section>

      <section className="block">
        <div className="container">
          <div className="cta">
            <div>
              <h2>Have a property to sell, rent out, or lease?</h2>
              <p>List it for free and reach buyers, tenants, and businesses looking right now.</p>
            </div>
            <Link href="/post" className="btn btn-primary">List your property</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
