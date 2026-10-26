// Builds /listings URLs from the current query plus a patch. Shared by server pages and client filters.
export type QueryLike = Record<string, string | undefined>;

/** Params that only make sense within one mode; dropped when the mode changes. */
const MODE_SCOPED = ["min", "max", "term", "pets", "type", "amenities"];

export function listingsHref(current: QueryLike, patch: QueryLike = {}, opts: { keepPage?: boolean } = {}) {
  const next: QueryLike = { ...current, ...patch };
  if ("mode" in patch && patch.mode !== current.mode) for (const k of MODE_SCOPED) if (!(k in patch)) delete next[k];
  if (!opts.keepPage && !("page" in patch)) delete next.page;
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(next)) {
    if (v === undefined || v === "" || v === "0") continue;
    if (k === "sort" && v === "relevance") continue;
    if (k === "page" && v === "1") continue;
    p.set(k, v);
  }
  const s = p.toString();
  return "/listings" + (s ? "?" + s : "");
}

export function toQuery(params: Record<string, string | string[] | undefined>): QueryLike {
  const q: QueryLike = {};
  for (const [k, v] of Object.entries(params)) q[k] = Array.isArray(v) ? v[0] : v;
  return q;
}
