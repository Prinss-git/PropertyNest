import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AuditRow } from "@/components/admin/AuditRow";
import { UserActions } from "@/components/admin/UserActions";
import { requireUser, STAFF_ROLES } from "@/lib/auth";
import { MODES, peso, timeAgo, type Mode } from "@/lib/catalog";
import { db } from "@/lib/db";
import { formatPhMobile } from "@/lib/phone";

export const metadata: Metadata = { title: "User", robots: { index: false } };

const ROLE_NAMES: Record<string, string> = { SEEKER: "Seeker", OWNER: "Owner", AGENT: "Agent", AGENCY_ADMIN: "Agency admin", MODERATOR: "Moderator", ADMIN: "Admin" };

export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser({ roles: STAFF_ROLES, next: "/admin?tab=users" });
  const { id } = await params;
  const u = await db.user.findUnique({
    where: { id },
    include: {
      agentProfile: { include: { agency: { select: { name: true } } } },
      _count: { select: { inquiriesSent: true, reportsFiled: true, sessions: true, favorites: true } },
    },
  });
  if (!u) notFound();

  const [listings, reportsAgainst, log] = await Promise.all([
    db.listing.findMany({
      where: { posterId: id },
      orderBy: { updatedAt: "desc" },
      take: 30,
      select: { refCode: true, title: true, mode: true, status: true, price: true, updatedAt: true, viewCount: true, inquiryCount: true },
    }),
    db.report.count({ where: { listing: { posterId: id } } }),
    db.auditLog.findMany({
      where: { OR: [{ actorId: id }, { entityType: "User", entityId: id }] },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { actor: { select: { id: true, name: true, role: true } } },
    }),
  ]);
  // Listing numbers for the activity rows that point at listings.
  const loggedListings = await db.listing.findMany({
    where: { id: { in: log.filter((r) => r.entityType === "Listing").map((r) => r.entityId) } },
    select: { id: true, refCode: true, status: true },
  });
  const listingById = new Map(loggedListings.map((l) => [l.id, l]));
  const staffTarget = u.role === "MODERATOR" || u.role === "ADMIN";
  const canAct = u.id !== me.id && u.status !== "DELETED" && (!staffTarget || me.role === "ADMIN");

  return (
    <>
      <div className="page-head">
        <div className="container">
          <div className="breadcrumb"><Link href="/admin">Moderation</Link> / <Link href="/admin?tab=users">Users</Link> / {u.name}</div>
          <h1>{u.name}</h1>
          <p className="muted" style={{ margin: "4px 0 0" }}>
            {ROLE_NAMES[u.role]} · <span className={`pill ${u.status === "ACTIVE" ? "ok" : "bad"}`}>{u.status.toLowerCase()}</span> · joined {u.createdAt.toISOString().slice(0, 10)}
            {u.lastLoginAt && <> · last logged in {timeAgo(u.lastLoginAt).toLowerCase()}</>}
          </p>
        </div>
      </div>
      <main className="container account-page">
        {u.status === "SUSPENDED" && u.statusReason && <div className="notice">Suspended: {u.statusReason}</div>}

        <section className="settings-card">
          <h2>Account</h2>
          <div className="spec-grid">
            <div><span>Email</span>{u.email ?? "none"} {u.email && (u.emailVerifiedAt ? <span className="pill ok">confirmed</span> : <span className="pill warn">not confirmed</span>)}</div>
            <div><span>Mobile</span>{u.phone ? formatPhMobile(u.phone) : "none"} {u.phoneVerifiedAt && <span className="pill ok">verified</span>}</div>
            <div><span>Log in with</span>{[u.passwordHash && "password", u.phone && "phone code", u.googleId && "Google"].filter(Boolean).join(", ") || "nothing"}</div>
            {u.agentProfile && (
              <div><span>PRC license</span>{u.agentProfile.prcLicenseNo ?? "none"} {u.agentProfile.licenseVerifiedAt ? <span className="pill ok">verified</span> : <span className="pill warn">not verified</span>}{u.agentProfile.agency && <> · {u.agentProfile.agency.name}</>}</div>
            )}
            <div><span>Activity</span>{u._count.inquiriesSent} inquiries sent · {u._count.favorites} saved · {u._count.reportsFiled} reports filed · {u._count.sessions} active sessions</div>
            <div><span>Reports against their listings</span>{reportsAgainst}</div>
          </div>
          <UserActions userId={u.id} status={u.status} role={u.role} canChangeRole={me.role === "ADMIN"} canAct={canAct} />
        </section>

        <section className="settings-card">
          <h2>Listings ({listings.length})</h2>
          {listings.length === 0 ? <p className="muted">No listings.</p> : (
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>Listing</th><th>Status</th><th>Price</th><th>Views</th><th>Inquiries</th><th>Updated</th></tr></thead>
                <tbody>
                  {listings.map((l) => (
                    <tr key={l.refCode}>
                      <td>{l.status === "ACTIVE" ? <Link href={`/property/${l.refCode}`}>{l.refCode}</Link> : l.refCode}<div className="muted">{l.title}</div></td>
                      <td>{l.status.toLowerCase()}</td>
                      <td>{peso(l.price.toNumber())}{MODES[l.mode.toLowerCase() as Mode].priceUnit && "/mo"}</td>
                      <td>{l.viewCount}</td>
                      <td>{l.inquiryCount}</td>
                      <td>{timeAgo(l.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="settings-card">
          <h2>Activity</h2>
          {log.length === 0 ? <p className="muted">Nothing recorded yet.</p> : (
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>When</th><th>Who</th><th>What</th><th>On</th></tr></thead>
                <tbody>{log.map((r) => <AuditRow key={r.id} row={r} listing={listingById.get(r.entityId)} user={r.entityType === "User" && r.entityId === u.id ? { id: u.id, name: u.name } : undefined} />)}</tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
