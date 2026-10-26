import type { Metadata } from "next";
import Link from "next/link";
import { LeadStatus } from "@/components/account/LeadStatus";
import { requireUser } from "@/lib/auth";
import { timeAgo } from "@/lib/catalog";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Inquiries", robots: { index: false } };

const FILTERS = [["open", "Open"], ["NEW", "New"], ["all", "All"]] as const;

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const user = await requireUser({ next: "/account/leads" });
  const show = (await searchParams).show ?? "open";
  const statusFilter =
    show === "NEW" ? { status: "NEW" as const }
    : show === "all" ? {}
    : { status: { in: ["NEW" as const, "CONTACTED" as const, "VIEWING_SCHEDULED" as const] } };

  const leads = await db.inquiry.findMany({
    where: { listing: { OR: [{ posterId: user.id }, { agentId: user.id }] }, ...statusFilter },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { listing: { select: { refCode: true, title: true } } },
  });

  return (
    <>
      <div className="page-head">
        <div className="container">
          <div className="breadcrumb"><Link href="/account">Account</Link> / Inquiries</div>
          <h1>Inquiries</h1>
          <p className="muted" style={{ margin: "4px 0 0" }}>People who contacted you about your listings. Reply quickly: most inquire with several agents.</p>
        </div>
      </div>
      <main className="container account-page">
        <div className="pill-tabs" style={{ marginBottom: 16 }}>
          {FILTERS.map(([v, l]) => <Link key={v} href={`/account/leads?show=${v}`} className={show === v ? "active" : ""}>{l}</Link>)}
        </div>
        {leads.length === 0 ? (
          <div className="empty"><h3>No inquiries here</h3><p>When someone contacts you about a listing, it shows up here and you get an SMS.</p></div>
        ) : (
          <div className="leads">
            {leads.map((q) => (
              <article key={q.id} className={`lead ${q.status === "NEW" ? "is-new" : ""}`}>
                <div className="lead-head">
                  <div>
                    <strong>{q.name}</strong>
                    <span className="muted"> · {timeAgo(q.createdAt)} · about <Link href={`/property/${q.listing.refCode}`}>{q.listing.refCode}</Link></span>
                  </div>
                  <LeadStatus id={q.id} status={q.status} />
                </div>
                <p className="lead-msg">{q.message}</p>
                <div className="lead-contact">
                  <a href={`mailto:${q.email}`}>{q.email}</a>
                  {q.phone && <a href={`tel:${q.phone.replace(/\s/g, "")}`}>{q.phone}</a>}
                  {q.company && <span>{q.company}</span>}
                  {q.preferredDate && <span>Move-in: {q.preferredDate.toISOString().slice(0, 10)}</span>}
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
