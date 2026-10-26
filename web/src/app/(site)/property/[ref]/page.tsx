import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FavButton } from "@/components/FavButton";
import { Icon } from "@/components/Icon";
import { ListingGrid } from "@/components/ListingCard";
import { NearbyMap } from "@/components/map/NearbyMap";
import { Gallery, InquiryForm, PhoneReveal, ReportListing, ShareButton } from "@/components/property/PropertyClient";
import { FURNISHING, MODES, RESIDENTIAL_TYPES, TYPES, peso, timeAgo, type Mode, type PropType } from "@/lib/catalog";
import { publicPoint } from "@/lib/geo";
import { getListing, getSimilar, type ListingDetail } from "@/lib/listings";

// Cached per listing for a minute. Edits will also revalidate the page directly (Phase 1).
export const revalidate = 60;
// No pages built ahead of time; each listing is rendered on its first visit, then served from cache.
export async function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ ref: string }> };
type Terms = Record<string, number | string | boolean | string[] | null | undefined>;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const l = await getListing(decodeURIComponent((await params).ref));
  if (!l) return { title: "Listing not found" };
  return {
    title: l.title,
    description: l.description.slice(0, 160),
    openGraph: { title: l.title, description: l.description.slice(0, 160), images: l.photos[0] ? [l.photos[0].storageKey] : [] },
  };
}

function CostBox({ l, mode, terms }: { l: ListingDetail; mode: Mode; terms: Terms }) {
  const price = l.price.toNumber();
  if (mode === "buy") {
    const down = price * 0.2, loan = price - down, r = 0.075 / 12, n = 240;
    const monthly = (loan * r) / (1 - Math.pow(1 + r, -n));
    return (
      <div className="cost-box">
        <div className="row"><span>20% down payment</span><strong>{peso(down)}</strong></div>
        <div className="row"><span>Loan amount</span><strong>{peso(loan)}</strong></div>
        <div className="row total"><span>Est. monthly (20 yrs @ 7.5%)</span><span>{peso(monthly)}</span></div>
        <Link className="link-more" style={{ fontSize: 13 }} href="/#calculator">Adjust in loan calculator →</Link>
      </div>
    );
  }
  const dep = Number(terms.depositMonths) || 0, adv = Number(terms.advanceMonths) || 0;
  if (mode === "rent") {
    return (
      <div className="cost-box">
        <div className="row"><span>Monthly rent</span><strong>{peso(price)}</strong></div>
        <div className="row"><span>Security deposit ({dep} mo.)</span><strong>{peso(price * dep)}</strong></div>
        <div className="row"><span>Advance rent ({adv} mo.)</span><strong>{peso(price * adv)}</strong></div>
        <div className="row total"><span>Move-in cost</span><span>{peso(price * (dep + adv))}</span></div>
      </div>
    );
  }
  const years = Number(terms.minTermYears) || 1, esc = Number(terms.escalationPct) || 0;
  const cusa = Number(terms.cusaPerSqm) && l.floorArea ? Number(terms.cusaPerSqm) * l.floorArea : 0;
  let total = 0;
  const rows = Array.from({ length: years }, (_, y) => {
    const m = price * Math.pow(1 + esc / 100, y);
    total += m * 12;
    return <div key={y} className="row"><span>Year {y + 1}</span><span>{peso(m)}/mo</span></div>;
  });
  return (
    <div className="cost-box">
      {rows}
      {cusa > 0 && <div className="row"><span>CUSA (₱{String(terms.cusaPerSqm)}/sqm)</span><span>{peso(cusa)}/mo</span></div>}
      <div className="row"><span>Deposit + advance</span><span>{dep} + {adv} mo.</span></div>
      <div className="row total"><span>Total rent, {years}-yr term</span><span>{peso(total)}</span></div>
    </div>
  );
}

export default async function PropertyPage({ params }: Props) {
  const l = await getListing(decodeURIComponent((await params).ref));
  if (!l) notFound();

  const mode = l.mode.toLowerCase() as Mode;
  const type = l.type.toLowerCase() as PropType;
  const m = MODES[mode], t = TYPES[type];
  const terms = (l.terms ?? {}) as Terms;
  const price = l.price.toNumber();
  const perSqmBase = l.floorArea || l.lotArea;
  const province = l.city.parent?.name ?? "";
  const placeLine = [l.area?.name, l.city.name, province].filter(Boolean).join(", ");
  const agentName = l.agent?.name ?? l.poster.name;
  const agency = l.agent?.agentProfile?.agency?.name ?? (l.poster.role === "OWNER" ? "Property owner" : "Independent");
  const agentPhone = l.agent?.agentProfile?.publicPhone ?? l.agent?.phone ?? null;
  const agentVerified = !!l.agent?.agentProfile?.licenseVerifiedAt;
  const featured = !!l.featuredUntil && l.featuredUntil > new Date();
  const similar = await getSimilar(l);

  const facts: [string, string | number][] = [["Type", t.label]];
  if (RESIDENTIAL_TYPES.includes(type)) facts.push(["Bedrooms", l.bedrooms || "Studio"]);
  if (l.bathrooms) facts.push(["Bathrooms", l.bathrooms]);
  if (l.floorArea) facts.push(["Floor area", `${l.floorArea.toLocaleString()} sqm`]);
  if (l.lotArea) facts.push(["Lot area", `${l.lotArea.toLocaleString()} sqm`]);
  if (l.parking) facts.push(["Parking", `${l.parking} slot${l.parking > 1 ? "s" : ""}`]);
  if (mode === "lease" && terms.minTermYears) facts.push(["Min. term", `${terms.minTermYears} year${Number(terms.minTermYears) > 1 ? "s" : ""}`]);
  if (mode === "rent" && terms.minStayMonths) facts.push(["Min. stay", `${terms.minStayMonths} months`]);
  if (mode === "buy" && terms.titleStatus) facts.push(["Status", String(terms.titleStatus)]);

  const details: [string, string][] = [
    ["Listing ID", l.refCode],
    ["Listing type", m.verb],
    ["Property type", t.label],
    ["Location", placeLine],
    ["Furnishing", FURNISHING[l.furnishing]],
    ["Posted", l.publishedAt ? `${l.publishedAt.toISOString().slice(0, 10)} (${timeAgo(l.publishedAt)})` : ""],
  ];
  if (mode === "buy") {
    if (perSqmBase) details.push(["Price per sqm", peso(price / perSqmBase)]);
    if (Array.isArray(terms.financing)) details.push(["Financing", terms.financing.join(", ")]);
  }
  if (mode === "rent") {
    details.push(["Deposit / advance", `${terms.depositMonths} month(s) / ${terms.advanceMonths} month(s)`]);
    details.push(["Pet friendly", terms.petFriendly ? "Yes" : "No"]);
  }
  if (mode === "lease") {
    details.push(["Annual escalation", `${terms.escalationPct}%`]);
    details.push(["Deposit / advance", `${terms.depositMonths} months / ${terms.advanceMonths} months`]);
    if (terms.cusaPerSqm) details.push(["CUSA", `₱${terms.cusaPerSqm} per sqm / month`]);
    if (l.floorArea) details.push(["Rate per sqm", `${peso(price / l.floorArea)} / month`]);
  }

  // Exact coordinates only if the poster opted in; otherwise an offset point for the approximate circle.
  const point = publicPoint(l);

  // schema.org data so search engines can show price and location in results.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: l.title,
    description: l.description,
    datePosted: l.publishedAt?.toISOString(),
    image: l.photos.map((p) => p.storageKey),
    offers: { "@type": "Offer", price, priceCurrency: "PHP", businessFunction: mode === "buy" ? "http://purl.org/goodrelations/v1#Sell" : "http://purl.org/goodrelations/v1#LeaseOut" },
    address: { "@type": "PostalAddress", addressLocality: l.city.name, addressRegion: province, addressCountry: "PH" },
  };

  return (
    <main className="container">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <div className="breadcrumb" style={{ marginTop: 20 }}>
        <Link href="/">Home</Link> / <Link href={`/listings?mode=${mode}`}>{m.label}</Link> /{" "}
        <Link href={`/listings?mode=${mode}&type=${type}`}>{t.plural}</Link> /{" "}
        <Link href={`/listings?mode=${mode}&q=${encodeURIComponent(l.city.name)}`}>{l.city.name}</Link>
      </div>

      <Gallery photos={l.photos.map((p) => p.storageKey)} title={l.title} icon={t.icon} />

      <div className="detail-layout">
        <div>
          {l.status !== "ACTIVE" && (
            <div className="notice">This listing is no longer available{l.closedReason ? ` (${l.closedReason.toLowerCase()})` : ""}.</div>
          )}
          <div className="detail-head">
            <div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <span className={`tag ${m.color}`}>{m.verb}</span>
                {featured && <span className="tag featured">Featured</span>}
                {l.verifiedAt && <span className="tag verified" style={{ border: "1px solid var(--line)" }}><Icon name="check" size={12} /> Verified</span>}
              </div>
              <h1>{l.title}</h1>
              <div className="card-loc"><Icon name="pin" size={16} /> {placeLine}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="detail-price">{peso(price)}{m.priceUnit && <small style={{ fontSize: 16, fontWeight: 500, color: "var(--muted)" }}> {m.priceUnit}</small>}</div>
              {mode === "buy" && perSqmBase ? <div className="muted" style={{ fontSize: 14 }}>{peso(price / perSqmBase)} / sqm</div> : null}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }}>
                <ShareButton />
                <FavButton refCode={l.refCode} variant="button" />
              </div>
            </div>
          </div>

          <div className="key-facts">
            {facts.slice(0, 8).map(([k, v]) => <div key={k} className="fact"><span>{k}</span><strong>{v}</strong></div>)}
          </div>

          <div className="panel">
            <h2>Description</h2>
            <p style={{ margin: 0, color: "var(--muted)", whiteSpace: "pre-line" }}>{l.description}</p>
          </div>

          {l.amenities.length > 0 && (
            <div className="panel">
              <h2>Amenities &amp; features</h2>
              <div className="amen">{l.amenities.map(({ amenity }) => <div key={amenity.id}><Icon name="check" /> {amenity.name}</div>)}</div>
            </div>
          )}

          <div className="panel">
            <h2>Property details</h2>
            <table className="spec-table">
              <tbody>
                {details.filter(([, v]) => v && v !== "N/A").map(([k, v]) => <tr key={k}><td>{k}</td><td>{v}</td></tr>)}
              </tbody>
            </table>
          </div>

          {point && (
            <div className="panel" id="nearby">
              <h2>What&apos;s nearby</h2>
              <NearbyMap
                refCode={l.refCode}
                point={point}
                address={point.exact && l.address ? `${l.address}, ${placeLine}` : placeLine}
              />
            </div>
          )}
        </div>

        <aside>
          <div className="side-card">
            <div className="agent">
              <div className="avatar">{agentName.split(" ").map((w) => w[0]).slice(0, 2).join("")}</div>
              <div>
                <strong>
                  {agentName}{" "}
                  {agentVerified && <span style={{ color: "var(--brand)" }} title="PRC-licensed, verified agent"><Icon name="shield" size={15} /></span>}
                </strong>
                <span>{agency}</span>
              </div>
            </div>
            <h3 style={{ margin: "4px 0 0", fontSize: 15 }}>{mode === "buy" ? "Payment estimate" : mode === "rent" ? "Move-in costs" : "Lease cost breakdown"}</h3>
            <CostBox l={l} mode={mode} terms={terms} />
            {l.status === "ACTIVE" && <InquiryForm refCode={l.refCode} mode={mode} agentName={agentName} />}
            {agentPhone && <PhoneReveal phone={agentPhone} />}
            <ReportListing refCode={l.refCode} />
          </div>
        </aside>
      </div>

      {similar.length > 0 && (
        <section style={{ paddingBottom: 64 }}>
          <div className="section-head">
            <div><h2>Similar properties {m.verb.toLowerCase()}</h2></div>
            <Link className="link-more" href={`/listings?mode=${mode}&type=${type}`}>See more →</Link>
          </div>
          <ListingGrid items={similar} />
        </section>
      )}
    </main>
  );
}
