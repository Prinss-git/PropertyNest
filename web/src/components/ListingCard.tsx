import Link from "next/link";
import { MODES, TYPES, peso } from "@/lib/catalog";
import type { ListingCard as Card } from "@/lib/listings";
import { FavButton } from "./FavButton";
import { Icon } from "./Icon";

function Specs({ l }: { l: Card }) {
  const s: React.ReactNode[] = [];
  if (l.beds) s.push(<span key="b" title="Bedrooms"><Icon name="bed" size={16} /> {l.beds} Bed{l.beds > 1 ? "s" : ""}</span>);
  else if (l.type === "condo" || l.type === "apartment") s.push(<span key="b"><Icon name="bed" size={16} /> Studio</span>);
  if (l.baths) s.push(<span key="ba" title="Bathrooms"><Icon name="bath" size={16} /> {l.baths} Bath{l.baths > 1 ? "s" : ""}</span>);
  if (l.floorArea) s.push(<span key="f" title="Floor area"><Icon name="area" size={16} /> {l.floorArea.toLocaleString()} sqm</span>);
  if (l.lotArea) s.push(<span key="l" title="Lot area"><Icon name="land" size={16} /> {l.lotArea.toLocaleString()} sqm lot</span>);
  if (!s.length) s.push(<span key="t"><Icon name="tag" size={16} /> {TYPES[l.type].label}</span>);
  return <div className="specs">{s}</div>;
}

export function ListingCard({ l }: { l: Card }) {
  const m = MODES[l.mode];
  const href = `/property/${encodeURIComponent(l.ref)}`;
  const t = l.terms as Record<string, number | undefined>;
  return (
    <article className="card">
      <Link href={href} className="card-media">
        {l.photo ? (
          // Plain <img>: photos will come from an image CDN that already serves resized variants.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={l.photo} alt={l.title} loading="lazy" />
        ) : (
          <span className="ph-icon"><Icon name={TYPES[l.type].icon} size={48} /></span>
        )}
        <div className="card-badges">
          <span className={`tag ${m.color}`}>{m.verb}</span>
          {l.featured && <span className="tag featured">Featured</span>}
          {l.verified && <span className="tag verified"><Icon name="check" size={12} /> Verified</span>}
        </div>
        <span className="photo-count"><Icon name="camera" size={13} /> {l.photoCount}</span>
      </Link>
      <FavButton refCode={l.ref} />
      <div className="card-body">
        <div className="price">
          {peso(l.price)}
          {m.priceUnit && <small> {m.priceUnit}</small>}
        </div>
        {l.mode === "lease" && t.minTermYears != null && (
          <span className="lease-term">Min. {t.minTermYears}-year lease · {t.escalationPct}% escalation</span>
        )}
        {l.mode === "rent" && t.depositMonths != null && (
          <span className="lease-term rent">{t.depositMonths} mo. deposit · {t.advanceMonths} mo. advance</span>
        )}
        <Link href={href} className="card-title">{l.title}</Link>
        <div className="card-loc"><Icon name="pin" size={14} /> {l.area ? `${l.area}, ` : ""}{l.city}</div>
        <p className="card-desc">{l.description}</p>
        <Specs l={l} />
      </div>
    </article>
  );
}

export function ListingGrid({ items, list = false }: { items: Card[]; list?: boolean }) {
  return (
    <div className={`listing-grid ${list ? "list" : ""}`}>
      {items.map((l) => <ListingCard key={l.ref} l={l} />)}
    </div>
  );
}
