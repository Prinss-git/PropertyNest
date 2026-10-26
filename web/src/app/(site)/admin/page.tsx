import type { Metadata } from "next";
import Link from "next/link";
import { AgentVerifyActions, ReviewActions } from "@/components/admin/ModerationActions";
import { requireUser, STAFF_ROLES } from "@/lib/auth";
import { MODES, TYPES, peso, timeAgo, type Mode, type PropType } from "@/lib/catalog";
import { db } from "@/lib/db";
import type { Flag } from "@/lib/moderation";
import { formatPhMobile } from "@/lib/phone";
import { smallVariant } from "@/lib/storage";

export const metadata: Metadata = { title: "Moderation", robots: { index: false } };

const TABS = [["queue", "Review queue"], ["reports", "Reports"], ["agents", "Agent licenses"], ["outbox", "Messages sent"], ["jobs", "Jobs"]] as const;
type Tab = (typeof TABS)[number][0];

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireUser({ roles: STAFF_ROLES, next: "/admin" });
  const tabParam = (await searchParams).tab;
  const tab: Tab = TABS.some(([t]) => t === tabParam) ? (tabParam as Tab) : "queue";

  const [pendingCount, reportCount, agentCount] = await Promise.all([
    db.listing.count({ where: { status: "PENDING" } }),
    db.report.count({ where: { status: "OPEN" } }),
    db.agentProfile.count({ where: { prcLicenseNo: { not: null }, licenseVerifiedAt: null } }),
  ]);
  const counts: Partial<Record<Tab, number>> = { queue: pendingCount, reports: reportCount, agents: agentCount };

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
  const [byStatus, failed] = await Promise.all([
    db.job.groupBy({ by: ["status"], _count: true }),
    db.job.findMany({ where: { status: "FAILED" }, orderBy: { finishedAt: "desc" }, take: 20 }),
  ]);
  const count = (s: string) => byStatus.find((b) => b.status === s)?._count ?? 0;
  return (
    <>
      <div className="stat-row">
        <div className="stat"><strong>{count("QUEUED")}</strong><span>Waiting</span></div>
        <div className="stat"><strong>{count("RUNNING")}</strong><span>Running</span></div>
        <div className="stat"><strong>{count("DONE")}</strong><span>Done</span></div>
        <div className="stat"><strong>{count("FAILED")}</strong><span>Failed</span></div>
      </div>
      {count("QUEUED") > 0 && <p className="muted">If &quot;Waiting&quot; keeps growing, the worker isn&apos;t running. Start it with <code>npm run worker</code>.</p>}
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
