import type { Metadata } from "next";
import Link from "next/link";
import { AgentVerifyActions, ReviewActions } from "@/components/admin/ModerationActions";
import { requireUser, STAFF_ROLES } from "@/lib/auth";
import { MODES, TYPES, peso, timeAgo, type Mode, type PropType } from "@/lib/catalog";
import { db } from "@/lib/db";
import type { Flag } from "@/lib/moderation";
import { auditLabel, AuditRow } from "@/components/admin/AuditRow";
import { SupportActions } from "@/components/admin/SupportActions";
import { CONTACT_TOPICS } from "@/lib/support";
import { formatPhMobile } from "@/lib/phone";
import { smallVariant } from "@/lib/storage";

export const metadata: Metadata = { title: "Moderation", robots: { index: false } };

const TABS = [["queue", "Review queue"], ["reports", "Reports"], ["agents", "Agent licenses"], ["support", "Support"], ["users", "Users"], ["activity", "Activity log"], ["outbox", "Messages sent"], ["jobs", "Jobs"]] as const;
type Tab = (typeof TABS)[number][0];

type Params = { tab?: string; q?: string; status?: string; action?: string };

export default async function AdminPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireUser({ roles: STAFF_ROLES, next: "/admin" });
  const sp = await searchParams;
  const tabParam = sp.tab;
  const tab: Tab = TABS.some(([t]) => t === tabParam) ? (tabParam as Tab) : "queue";

  const [pendingCount, reportCount, agentCount, supportCount] = await Promise.all([
    db.listing.count({ where: { status: "PENDING" } }),
    db.report.count({ where: { status: "OPEN" } }),
    db.agentProfile.count({ where: { prcLicenseNo: { not: null }, licenseVerifiedAt: null } }),
    db.contactMessage.count({ where: { status: "OPEN" } }),
  ]);
  const counts: Partial<Record<Tab, number>> = { queue: pendingCount, reports: reportCount, agents: agentCount, support: supportCount };

  return (
    <>
      <div className="page-head">
        <div className="container">
          <div className="breadcrumb"><Link href="/account">Account</Link> / Moderation</div>
          <h1>Moderation</h1>
          <div className="pill-tabs" style={{ marginTop: 14, flexWrap: "wrap" }}>
            {TABS.map(([t, label]) => (
              <Link key={t} href={`/admin?tab=${t}`} className={tab === t ? "active" : ""}>
                {label}{counts[t] ? <span className="count-badge">{counts[t]}</span> : null}
              </Link>
            ))}
          </div>
        </div>
      </div>
      <main className="container account-page">
        {tab === "queue" && <Queue />}
        {tab === "reports" && <Reports />}
        {tab === "agents" && <Agents />}
        {tab === "outbox" && <Outbox />}
        {tab === "support" && <Support status={sp.status} />}
        {tab === "users" && <Users q={sp.q} status={sp.status} />}
        {tab === "activity" && <Activity action={sp.action} />}
        {tab === "jobs" && <Jobs />}
      </main>
    </>
  );
}

async function Queue() {
  const items = await db.listing.findMany({
    where: { status: "PENDING" },
    orderBy: { updatedAt: "asc" }, // oldest first: fair to posters
    take: 50,
    include: {
      photos: { orderBy: { position: "asc" }, take: 4 },
      city: { select: { name: true } },
      area: { select: { name: true } },
      poster: { select: { name: true, role: true, phone: true, createdAt: true, agentProfile: { select: { licenseVerifiedAt: true } } } },
    },
  });
  if (!items.length) return <div className="empty"><h3>Queue is empty</h3><p>New listings that trip an automatic check show up here.</p></div>;
  return (
    <div className="mod-list">
      {items.map((l) => {
        const flags = (l.moderationFlags ?? []) as unknown as Flag[];
        const mode = l.mode.toLowerCase() as Mode;
        return (
          <article key={l.id} className="mod-item">
            <div className="mod-photos">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {l.photos.map((p) => <img key={p.id} src={smallVariant(p.storageKey)} alt="" />)}
            </div>
            <div className="mod-body">
              <div className="muted" style={{ fontSize: 13 }}>{l.refCode} · {MODES[mode].verb} · {TYPES[l.type.toLowerCase() as PropType].label} · waiting {timeAgo(l.updatedAt).toLowerCase()}</div>
              <strong className="card-title">{l.title}</strong>
              <div className="price" style={{ fontSize: 17 }}>{peso(l.price.toNumber())}{MODES[mode].priceUnit && <small> {MODES[mode].priceUnit}</small>} · <span className="muted" style={{ fontSize: 14, fontWeight: 500 }}>{l.area?.name}, {l.city.name}</span></div>
              <ul className="flags">{flags.map((f, i) => <li key={i}><code>{f.code}</code> {f.message}</li>)}</ul>
              <p className="mod-desc">{l.description}</p>
              <div className="muted" style={{ fontSize: 13 }}>
                Posted by {l.poster.name} ({l.poster.role.toLowerCase()}{l.poster.agentProfile?.licenseVerifiedAt ? ", PRC verified" : ""}) · {l.poster.phone ? formatPhMobile(l.poster.phone) : "no phone"} · member since {l.poster.createdAt.toISOString().slice(0, 10)}
              </div>
              <ReviewActions refCode={l.refCode} />
            </div>
          </article>
        );
      })}
    </div>
  );
}

async function Reports() {
  const reports = await db.report.findMany({
    where: { status: "OPEN" },
    orderBy: { createdAt: "asc" },
    take: 100,
    include: { listing: { select: { refCode: true, title: true, status: true } }, reporter: { select: { name: true } } },
  });
  if (!reports.length) return <div className="empty"><h3>No open reports</h3><p>Reports from users about fake, duplicate, or scam listings show up here.</p></div>;
  const byListing = new Map<string, typeof reports>();
  for (const r of reports) byListing.set(r.listing.refCode, [...(byListing.get(r.listing.refCode) ?? []), r]);
  return (
    <div className="mod-list">
      {[...byListing.entries()].map(([ref, rs]) => (
        <article key={ref} className="mod-item no-photos">
          <div className="mod-body">
            <div className="muted" style={{ fontSize: 13 }}>{ref} · {rs.length} report{rs.length > 1 ? "s" : ""} · listing is {rs[0].listing.status.toLowerCase()}</div>
            {rs[0].listing.status === "ACTIVE"
              ? <Link href={`/property/${ref}`} className="card-title" target="_blank">{rs[0].listing.title}</Link>
              : <strong className="card-title">{rs[0].listing.title}</strong>}
            <ul className="flags">
              {rs.map((r) => <li key={r.id}><code>{r.reason.toLowerCase()}</code> {r.details ?? ""} <span className="muted">by {r.reporter?.name ?? "deleted user"}, {timeAgo(r.createdAt).toLowerCase()}</span></li>)}
            </ul>
            <ReviewActions refCode={ref} mode="report" />
          </div>
        </article>
      ))}
    </div>
  );
}

async function Agents() {
  const agents = await db.agentProfile.findMany({
    where: { prcLicenseNo: { not: null }, licenseVerifiedAt: null },
    include: { user: { select: { id: true, name: true, phone: true, email: true, createdAt: true } }, agency: { select: { name: true } } },
    orderBy: { user: { createdAt: "asc" } },
  });
  if (!agents.length) return <div className="empty"><h3>No licenses to check</h3><p>New agent sign-ups show up here.</p></div>;
  return (
    <>
      <p className="muted">Check each number on the <a href="https://online.prc.gov.ph/Verification" target="_blank" rel="noopener noreferrer">PRC license verification site</a> (profession: Real Estate Broker / Salesperson), then confirm here.</p>
      <div className="mod-list">
        {agents.map((a) => (
          <article key={a.userId} className="mod-item no-photos">
            <div className="mod-body">
              <strong>{a.user.name}</strong>
              <div>PRC license: <code className="big-code">{a.prcLicenseNo}</code></div>
              <div className="muted" style={{ fontSize: 13 }}>{a.agency?.name ?? "No agency"} · {a.user.phone ? formatPhMobile(a.user.phone) : ""} {a.user.email ? `· ${a.user.email}` : ""} · signed up {timeAgo(a.user.createdAt).toLowerCase()}</div>
              <AgentVerifyActions userId={a.user.id} />
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

async function Outbox() {
  const msgs = await db.outboundMessage.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
  return (
    <>
      <p className="muted">The last 50 SMS and emails the system sent. With the <code>console</code> providers (development), this is where you read them.</p>
      {msgs.length === 0 ? <div className="empty"><h3>Nothing sent yet</h3></div> : (
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>When</th><th>Channel</th><th>To</th><th>Message</th><th>Status</th></tr></thead>
            <tbody>
              {msgs.map((m) => (
                <tr key={m.id}>
                  <td>{timeAgo(m.createdAt)}<br /><span className="muted">{m.createdAt.toISOString().slice(11, 19)}</span></td>
                  <td>{m.channel}</td>
                  <td>{m.channel === "SMS" ? formatPhMobile(m.to) : m.to}</td>
                  <td className="msg-cell">{m.subject && <strong>{m.subject}<br /></strong>}{m.body}</td>
                  <td><span className={`pill ${m.status === "SENT" ? "ok" : "bad"}`}>{m.status.toLowerCase()}</span> <span className="muted">{m.provider}</span>{m.error && <div className="muted">{m.error}</div>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

async function Jobs() {
  const [byStatus, failed, maintenance] = await Promise.all([
    db.job.groupBy({ by: ["status"], _count: true }),
    db.job.findMany({ where: { status: "FAILED" }, orderBy: { finishedAt: "desc" }, take: 20 }),
    db.cronRun.findUnique({ where: { name: "maintenance" } }),
  ]);
  const count = (s: string) => byStatus.find((b) => b.status === s)?._count ?? 0;
  const result = (maintenance?.lastResult ?? null) as Record<string, number> | null;
  // Maintenance runs every 10 minutes; much older than that means no worker is running.
  const stale = !maintenance?.lastFinishedAt || Date.now() - maintenance.lastFinishedAt.getTime() > 30 * 60_000;
  return (
    <>
      <div className="stat-row">
        <div className="stat"><strong>{count("QUEUED")}</strong><span>Waiting</span></div>
        <div className="stat"><strong>{count("RUNNING")}</strong><span>Running</span></div>
        <div className="stat"><strong>{count("DONE")}</strong><span>Done</span></div>
        <div className="stat"><strong>{count("FAILED")}</strong><span>Failed</span></div>
      </div>
      {count("QUEUED") > 0 && <p className="muted">If &quot;Waiting&quot; keeps growing, the worker isn&apos;t running. Start it with <code>npm run worker</code>.</p>}
      <section className="settings-card">
        <h2>Scheduled maintenance</h2>
        <p className="muted">
          Every 10 minutes: expires listings past their date, sends &quot;expires in 3 days&quot; reminders, and deletes old login codes,
          expired sessions and abandoned photo uploads.{" "}
          {maintenance?.lastFinishedAt
            ? <>Last run finished {maintenance.lastFinishedAt.toISOString().slice(0, 16).replace("T", " ")} UTC.</>
            : <>It hasn&apos;t run yet.</>}
        </p>
        {stale && <p className="flag-note">No recent run. Make sure <code>npm run worker</code> is running.</p>}
        {result && (
          <p className="muted" style={{ margin: 0 }}>
            Last run: {result.listingsExpired} listings expired, {result.remindersSent} reminders sent, {result.uploadsDeleted} unused photos,{" "}
            {result.otpCodesDeleted} login codes and {result.sessionsDeleted} sessions cleaned up.
          </p>
        )}
      </section>
      {failed.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Type</th><th>Attempts</th><th>Last error</th></tr></thead>
            <tbody>{failed.map((j) => <tr key={j.id}><td>{j.type}</td><td>{j.attempts}</td><td className="msg-cell">{j.lastError}</td></tr>)}</tbody>
          </table>
        </div>
      )}
    </>
  );
}

const ROLE_NAMES: Record<string, string> = { SEEKER: "Seeker", OWNER: "Owner", AGENT: "Agent", AGENCY_ADMIN: "Agency admin", MODERATOR: "Moderator", ADMIN: "Admin" };

async function Users({ q, status }: { q?: string; status?: string }) {
  const term = q?.trim();
  const statusFilter = status === "SUSPENDED" ? "SUSPENDED" : undefined;
  const digits = term?.replace(/\D/g, "") ?? "";
  const users = await db.user.findMany({
    where: {
      status: statusFilter ?? { not: "DELETED" },
      ...(term
        ? {
            OR: [
              { name: { contains: term, mode: "insensitive" } },
              { email: { contains: term, mode: "insensitive" } },
              // Phone numbers are stored as +639…, so match on the last digits people type.
              ...(digits.length >= 4 ? [{ phone: { contains: digits.replace(/^0/, "") } }] : []),
              { agentProfile: { prcLicenseNo: { contains: term, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true, name: true, email: true, phone: true, role: true, status: true, createdAt: true, lastLoginAt: true,
      _count: { select: { postedListings: true, reportsFiled: true } },
    },
  });
  return (
    <>
      <form className="admin-search" action="/admin">
        <input type="hidden" name="tab" value="users" />
        <input className="input" name="q" defaultValue={term ?? ""} placeholder="Name, email, mobile number, or PRC license" aria-label="Search users" />
        <select className="select" name="status" defaultValue={statusFilter ?? ""} aria-label="Status">
          <option value="">All accounts</option>
          <option value="SUSPENDED">Suspended only</option>
        </select>
        <button className="btn btn-brand btn-sm">Search</button>
      </form>
      {users.length === 0 ? <div className="empty"><h3>No users found</h3></div> : (
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Name</th><th>Contact</th><th>Role</th><th>Status</th><th>Listings</th><th>Joined</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td><Link href={`/admin/users/${u.id}`} className="link-strong">{u.name}</Link></td>
                  <td>{u.email ?? ""}{u.email && u.phone ? <br /> : null}{u.phone ? formatPhMobile(u.phone) : ""}</td>
                  <td>{ROLE_NAMES[u.role]}</td>
                  <td><span className={`pill ${u.status === "ACTIVE" ? "ok" : "bad"}`}>{u.status.toLowerCase()}</span></td>
                  <td>{u._count.postedListings}</td>
                  <td>{u.createdAt.toISOString().slice(0, 10)}<br /><span className="muted">{u.lastLoginAt ? `last seen ${timeAgo(u.lastLoginAt).toLowerCase()}` : "never logged in"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

const ACTION_GROUPS: [string, string][] = [["", "All activity"], ["listing.", "Listings"], ["user.", "Accounts"], ["agent.", "Agent licenses"]];

async function Activity({ action }: { action?: string }) {
  const prefix = ACTION_GROUPS.some(([p]) => p === action) ? action : "";
  const rows = await db.auditLog.findMany({
    where: prefix ? { action: { startsWith: prefix } } : {},
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { actor: { select: { id: true, name: true, role: true } } },
  });
  // Resolve listing refs and user names for the rows, in two queries.
  const listingIds = rows.filter((r) => r.entityType === "Listing").map((r) => r.entityId);
  const userIds = rows.filter((r) => r.entityType === "User").map((r) => r.entityId);
  const [listings, users] = await Promise.all([
    db.listing.findMany({ where: { id: { in: listingIds } }, select: { id: true, refCode: true, status: true } }),
    db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }),
  ]);
  const listingMap = new Map(listings.map((l) => [l.id, l]));
  const userMap = new Map(users.map((u) => [u.id, u]));
  return (
    <>
      <div className="pill-tabs" style={{ justifySelf: "start" }}>
        {ACTION_GROUPS.map(([p, label]) => (
          <Link key={p} href={`/admin?tab=activity${p ? `&action=${p}` : ""}`} className={prefix === p ? "active" : ""}>{label}</Link>
        ))}
      </div>
      <p className="muted">The latest 200 actions{prefix ? ` (${auditLabel(prefix).toLowerCase()})` : ""}. Every sign-up, listing change, moderation decision and account change is recorded here.</p>
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>When</th><th>Who</th><th>What</th><th>On</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <AuditRow key={r.id} row={r} listing={listingMap.get(r.entityId)} user={userMap.get(r.entityId)} />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

async function Support({ status }: { status?: string }) {
  const filter = status === "ANSWERED" || status === "CLOSED" ? status : "OPEN";
  const msgs = await db.contactMessage.findMany({ where: { status: filter }, orderBy: { createdAt: filter === "OPEN" ? "asc" : "desc" }, take: 100 });
  const topic = (t: string) => CONTACT_TOPICS.find(([v]) => v === t)?.[1] ?? t;
  return (
    <>
      <div className="pill-tabs" style={{ justifySelf: "start" }}>
        {(["OPEN", "ANSWERED", "CLOSED"] as const).map((s) => (
          <Link key={s} href={`/admin?tab=support&status=${s}`} className={filter === s ? "active" : ""}>{s === "OPEN" ? "Open" : s === "ANSWERED" ? "Answered" : "Closed"}</Link>
        ))}
      </div>
      {msgs.length === 0 ? (
        <div className="empty"><h3>No {filter.toLowerCase()} messages</h3><p>Messages from the Contact page show up here{process.env.SUPPORT_EMAIL ? ` and are emailed to ${process.env.SUPPORT_EMAIL}` : ""}.</p></div>
      ) : (
        <div className="mod-list">
          {msgs.map((m) => (
            <article key={m.id} className="mod-item no-photos">
              <div className="mod-body">
                <div className="muted" style={{ fontSize: 13 }}>
                  {topic(m.topic)} · {timeAgo(m.createdAt)}{m.listingRef ? <> · about <Link href={`/property/${m.listingRef}`}>{m.listingRef}</Link></> : null}
                  {m.userId ? <> · <Link href={`/admin/users/${m.userId}`}>has an account</Link></> : " · not logged in"}
                </div>
                <strong>{m.name} <span className="muted" style={{ fontWeight: 400 }}>{m.email}{m.phone ? ` · ${m.phone}` : ""}</span></strong>
                <p className="lead-msg">{m.message}</p>
                <SupportActions id={m.id} status={m.status} email={m.email} subject={topic(m.topic)} />
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
