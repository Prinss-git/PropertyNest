import type { Metadata } from "next";
import Link from "next/link";
import { ListingActions } from "@/components/account/ListingActions";
import { requireUser } from "@/lib/auth";
import { MODES, peso, timeAgo, type Mode } from "@/lib/catalog";
import { db } from "@/lib/db";
import type { Flag } from "@/lib/moderation";
import { formatPhMobile } from "@/lib/phone";
import { smallVariant } from "@/lib/storage";

export const metadata: Metadata = { title: "My account", robots: { index: false } };

const ROLE_LABEL: Record<string, string> = {
  SEEKER: "Looking for a place", OWNER: "Property owner", AGENT: "Agent / broker", AGENCY_ADMIN: "Agency admin", MODERATOR: "Moderator", ADMIN: "Admin",
};
const STATUS: Record<string, [string, string]> = {
  ACTIVE: ["Live", "ok"], PENDING: ["In review", "warn"], REJECTED: ["Needs changes", "bad"], DRAFT: ["Draft", "muted"],
  EXPIRED: ["Expired", "muted"], CLOSED: ["Closed", "muted"], ARCHIVED: ["Archived", "muted"],
};

type Props = { searchParams: Promise<{ saved?: string; status?: string; denied?: string }> };

export default async function AccountPage({ searchParams }: Props) {
  const user = await requireUser({ next: "/account" });
  const sp = await searchParams;
  const [listings, newLeads, favCount] = await Promise.all([
    db.listing.findMany({
      where: { posterId: user.id, status: { not: "ARCHIVED" } },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true, refCode: true, title: true, mode: true, status: true, price: true, rejectionReason: true, moderationFlags: true,
        updatedAt: true, expiresAt: true, viewCount: true, inquiryCount: true,
        photos: { select: { storageKey: true }, orderBy: { position: "asc" }, take: 1 },
      },
    }),
    db.inquiry.count({ where: { status: "NEW", listing: { OR: [{ posterId: user.id }, { agentId: user.id }] } } }),
    db.favorite.count({ where: { userId: user.id } }),
  ]);
  const staff = user.role === "MODERATOR" || user.role === "ADMIN";
  // Views in the last 7 days per listing (Philippine dates), from the daily stats the view counter writes.
  const weekAgo = new Date(Date.now() - 7 * 864e5);
  const weekly = listings.length
    ? await db.listingStatDaily.groupBy({ by: ["listingId"], where: { listingId: { in: listings.map((l) => l.id) }, date: { gte: weekAgo } }, _sum: { views: true } })
    : [];
  const weekViews = new Map(weekly.map((w) => [w.listingId, w._sum.views ?? 0]));
  const totalWeekViews = weekly.reduce((n, w) => n + (w._sum.views ?? 0), 0);

  return (
    <>
      <div className="page-head">
        <div className="container">
          <div className="breadcrumb"><Link href="/">Home</Link> / Account</div>
          <div className="head-row">
            <h1>Hi, {user.name.split(" ")[0]}</h1>
            <Link className="btn btn-outline btn-sm" href="/account/settings">Account settings</Link>
          </div>
          <p className="muted" style={{ margin: "4px 0 0" }}>
            {ROLE_LABEL[user.role]} · {user.phone ? formatPhMobile(user.phone) : "no phone"}
            {user.role === "AGENT" && (user.agent?.licenseVerifiedAt
              ? <> · <span className="pill ok">PRC verified</span></>
              : <> · <span className="pill warn">PRC {user.agent?.prcLicenseNo} pending verification</span></>)}
          </p>
        </div>
      </div>

      <main className="container account-page">
        {sp.denied && <div className="notice">Your account doesn&apos;t have access to that page.</div>}
        {!user.verified && <div className="notice">Confirm your email to post listings. <Link href="/account/settings">Resend the link from Account settings</Link>.</div>}
        {sp.saved && (
          <div className={`notice ${sp.status === "ACTIVE" ? "ok" : ""}`}>
            {sp.status === "ACTIVE"
              ? <>Listing <Link href={`/property/${sp.saved}`}><strong>{sp.saved}</strong></Link> is live.</>
              : <>Listing <strong>{sp.saved}</strong> was saved and is waiting for a quick review. We&apos;ll text you when it&apos;s live.</>}
          </div>
        )}

        <div className="stat-row">
          <Link href="/account/leads" className="stat"><strong>{newLeads}</strong><span>New inquiries</span></Link>
          <div className="stat"><strong>{listings.filter((l) => l.status === "ACTIVE").length}</strong><span>Live listings</span></div>
          <div className="stat"><strong>{totalWeekViews.toLocaleString()}</strong><span>Listing views this week</span></div>
          <Link href="/saved" className="stat"><strong>{favCount}</strong><span>Saved listings</span></Link>
          {staff && <Link href="/admin" className="stat"><strong>→</strong><span>Moderation queue</span></Link>}
        </div>

        <section id="listings">
          <div className="section-head" style={{ marginBottom: 14 }}>
            <div><h2 style={{ fontSize: 22 }}>My listings</h2></div>
            <Link className="btn btn-primary btn-sm" href="/post">+ New listing</Link>
          </div>
          {listings.length === 0 ? (
            <div className="empty">
              <h3>No listings yet</h3>
              <p>Post a property to sell, rent out, or lease. It takes about 3 minutes.</p>
              <Link className="btn btn-primary" href="/post">List a property</Link>
            </div>
          ) : (
            <div className="my-listings">
              {listings.map((l) => {
                const mode = l.mode.toLowerCase() as Mode;
                const [label, tone] = STATUS[l.status];
                const flags = (l.moderationFlags ?? []) as unknown as Flag[];
                return (
                  <article key={l.refCode} className="my-listing">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {l.photos[0] ? <img src={smallVariant(l.photos[0].storageKey)} alt="" /> : <div className="thumb-empty" />}
                    <div className="my-listing-body">
                      <div className="my-listing-top">
                        <span className={`pill ${tone}`}>{label}</span>
                        <span className="muted" style={{ fontSize: 13 }}>{l.refCode} · {MODES[mode].verb} · updated {timeAgo(l.updatedAt)}</span>
                      </div>
                      <Link href={l.status === "ACTIVE" ? `/property/${l.refCode}` : `/account/listings/${l.refCode}/edit`} className="card-title">{l.title}</Link>
                      <div className="price" style={{ fontSize: 17 }}>{peso(l.price.toNumber())}{MODES[mode].priceUnit && <small> {MODES[mode].priceUnit}</small>}</div>
                      {l.status === "REJECTED" && l.rejectionReason && <p className="flag-note bad">Moderator: {l.rejectionReason}</p>}
                      {l.status === "PENDING" && flags.length > 0 && <p className="flag-note">Under review: {flags.map((f) => f.message).join(" ")}</p>}
                      {l.status === "EXPIRED" && <p className="flag-note">Hidden from search since it expired. Renew it to bring it back.</p>}
                      <div className="muted" style={{ fontSize: 13 }}>
                        {l.viewCount.toLocaleString()} views ({(weekViews.get(l.id) ?? 0).toLocaleString()} this week) · {l.inquiryCount} inquiries
                        {l.status === "ACTIVE" && l.expiresAt && <> · expires {l.expiresAt.toISOString().slice(0, 10)}</>}
                      </div>
                      <ListingActions refCode={l.refCode} status={l.status} mode={mode} />
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
