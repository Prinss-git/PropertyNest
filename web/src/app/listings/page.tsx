import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Filters } from "@/components/listings/Filters";
import { ResultsView } from "@/components/listings/ResultsView";
import { MODES, MODE_KEYS, TYPES, pesoShort } from "@/lib/catalog";
import { parseSearch, searchListings, type SearchFilters } from "@/lib/listings";
import { listingsHref, toQuery, type QueryLike } from "@/lib/searchUrl";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function heading(f: SearchFilters) {
  const what = f.type ? TYPES[f.type].plural : "Properties";
  const mode = f.mode ? " " + MODES[f.mode].verb.toLowerCase() : "";
  const where = f.q ? ` in ${f.q}` : " in the Philippines";
  return what + mode + where;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const f = parseSearch(await searchParams);
  return { title: heading(f) };
}

function activeChips(f: SearchFilters): [string, QueryLike][] {
  const chips: [string, QueryLike][] = [];
  if (f.type) chips.push([TYPES[f.type].label, { type: undefined }]);
  if (f.q) chips.push([`"${f.q}"`, { q: undefined }]);
  if (f.min || f.max) chips.push([`${f.min ? pesoShort(f.min) : "₱0"} – ${f.max ? pesoShort(f.max) : "any"}`, { min: undefined, max: undefined }]);
  if (f.beds) chips.push([`${f.beds}+ beds`, { beds: undefined }]);
  if (f.baths) chips.push([`${f.baths}+ baths`, { baths: undefined }]);
  if (f.minArea) chips.push([`${f.minArea}+ sqm`, { minArea: undefined }]);
  if (f.furnishing) chips.push([f.furnishing, { furnishing: undefined }]);
  if (f.term) chips.push([`≤ ${f.term}-yr term`, { term: undefined }]);
  if (f.verified) chips.push(["Verified", { verified: undefined }]);
  if (f.pets) chips.push(["Pet friendly", { pets: undefined }]);
  for (const a of f.amenities) {
    const rest = f.amenities.filter((x) => x !== a);
    chips.push([a, { amenities: rest.length ? rest.join("|") : undefined }]);
  }
  return chips;
}

export default async function ListingsPage({ searchParams }: Props) {
  const raw = await searchParams;
  const f = parseSearch(raw);
  // Links and filters build on the validated values, so junk like ?mode=bogus is dropped rather than echoed.
  const query = {
    ...toQuery(raw),
    mode: f.mode,
    type: f.type,
    min: f.min ? String(f.min) : undefined,
    max: f.max ? String(f.max) : undefined,
    page: String(f.page),
    sort: f.sort,
  };
  const result = await searchListings(f);
  const chips = activeChips(f);

  return (
    <>
      <div className="page-head">
        <div className="container">
          <div className="breadcrumb"><Link href="/">Home</Link> / {f.mode ? MODES[f.mode].label : "All properties"}</div>
          <h1>{heading(f)}</h1>
          <form className="quickbar" action="/listings" autoComplete="off">
            <div className="pill-tabs">
              <Link href={listingsHref(query, { mode: undefined })} className={!f.mode ? "active" : ""}>All</Link>
              {MODE_KEYS.map((m) => (
                <Link key={m} href={listingsHref(query, { mode: m })} className={f.mode === m ? "active" : ""}>{MODES[m].label}</Link>
              ))}
            </div>
            {f.mode && <input type="hidden" name="mode" value={f.mode} />}
            {f.type && <input type="hidden" name="type" value={f.type} />}
            <input className="input" name="q" defaultValue={f.q ?? ""} placeholder="Search city, area, or property type" aria-label="Search" />
            <button className="btn btn-brand" type="submit">Search</button>
          </form>
        </div>
      </div>

      <main className="container layout">
        <Filters query={query} />
        <section>
          {chips.length > 0 && (
            <div className="active-filters">
              {chips.map(([label, patch]) => (
                <Link key={label} className="chip" href={listingsHref(query, patch)}>{label} <Icon name="x" size={12} /></Link>
              ))}
            </div>
          )}
          {result.total > 0 ? (
            <ResultsView query={query} items={result.items} total={result.total} />
          ) : (
            <div className="empty">
              <Icon name="search" size={40} />
              <h3>No properties match your search</h3>
              <p>Try removing a filter or searching a nearby city.</p>
              <Link className="btn btn-outline" href={listingsHref({ mode: f.mode })}>Reset search</Link>
            </div>
          )}
          {result.pages > 1 && (
            <nav className="pagination" aria-label="Pages">
              {result.page > 1 && <Link href={listingsHref(query, { page: String(result.page - 1) })} aria-label="Previous page">‹</Link>}
              {Array.from({ length: result.pages }, (_, i) => i + 1).map((p) => (
                <Link key={p} href={listingsHref(query, { page: String(p) })} className={p === result.page ? "active" : ""} aria-current={p === result.page ? "page" : undefined}>{p}</Link>
              ))}
              {result.page < result.pages && <Link href={listingsHref(query, { page: String(result.page + 1) })} aria-label="Next page">›</Link>}
            </nav>
          )}
        </section>
      </main>
    </>
  );
}
