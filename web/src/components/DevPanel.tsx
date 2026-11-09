"use client";
import { useEffect, useState } from "react";

// Developer panel for local testing: switch accounts in one click and read the SMS/emails the site "sent".
// Rendered only when DEV_TOOLS=1 on a non-https site (see src/lib/devTools.ts).

type DevUser = { id: string; name: string; role: string; status: string; contact: string; listings: number; verifiedAgent: boolean };
type DevMessage = { id: string; channel: string; to: string; subject: string | null; body: string; createdAt: string };
type State = { meId: string | null; users: DevUser[]; messages: DevMessage[] };

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin", MODERATOR: "Moderator", AGENT: "Agent", OWNER: "Owner", SEEKER: "Seeker", AGENCY_ADMIN: "Agency admin",
};

// Most pages look the same to everyone; these are the places where each kind of account sees something different.
const ROLE_GUIDE: Record<string, { what: string; links: [string, string][] }> = {
  ADMIN: { what: "Everything a moderator has, plus suspending users and changing roles.", links: [["/admin", "Review queue"], ["/admin?tab=users", "Users & roles"], ["/admin?tab=activity", "Activity log"]] },
  MODERATOR: { what: "Approves or rejects new listings, handles reports and checks agent licenses. Can't change roles.", links: [["/admin", "Review queue"], ["/admin?tab=reports", "Reports"], ["/admin?tab=agents", "Agent licenses"]] },
  AGENT: { what: "Posts up to 30 listings, gets inquiries, sees views. A verified PRC license shows a badge.", links: [["/account", "My listings & stats"], ["/account/leads", "Inquiries"], ["/post", "Post a listing"]] },
  AGENCY_ADMIN: { what: "Manages the agency's listings.", links: [["/account", "My listings"], ["/account/leads", "Inquiries"]] },
  OWNER: { what: "Posts up to 3 listings and gets inquiries. Can't open moderation.", links: [["/account", "My listings"], ["/account/leads", "Inquiries"], ["/post", "Post a listing"]] },
  SEEKER: { what: "Browses, saves listings and sends inquiries. Becomes an owner on first post.", links: [["/saved", "Saved listings"], ["/account", "My account"], ["/admin", "Try moderation (blocked)"]] },
};

export function DevPanel() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"accounts" | "messages">("accounts");
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const load = () => fetch("/api/dev/state", { cache: "no-store" }).then((r) => r.json()).then(setState).catch(() => {});
  useEffect(() => {
    void load();
    // Re-open the panel after a switch so the "where to look" links are right there.
    try {
      if (sessionStorage.getItem("pn_dev_open")) { sessionStorage.removeItem("pn_dev_open"); setOpen(true); }
    } catch {}
  }, []);
  useEffect(() => {
    if (open) void load();
  }, [open]);
  // While the Messages tab is open, keep it fresh so new SMS codes appear on their own.
  useEffect(() => {
    if (!open || tab !== "messages") return;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [open, tab]);

  async function switchTo(userId: string | null) {
    setBusy(userId ?? "logout");
    await fetch("/api/dev/switch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) });
    // Switching keeps you on the same page; logging out goes home (account pages would bounce to log in).
    try { sessionStorage.setItem("pn_dev_open", "1"); } catch {}
    if (userId) window.location.reload();
    else window.location.href = "/";
  }

  const q = filter.trim().toLowerCase();
  const users = (state?.users ?? []).filter((u) => !q || `${u.name} ${u.contact} ${u.role}`.toLowerCase().includes(q));
  const me = state?.users.find((u) => u.id === state.meId);

  return (
    <div className={`devpanel ${open ? "open" : ""}`}>
      {open && (
        <div className="devpanel-box" role="dialog" aria-label="Developer panel">
          <div className="devpanel-head">
            <strong>Dev tools</strong>
            <span className="devpanel-me">{me ? <>Logged in as <b>{me.name}</b> ({ROLE_LABEL[me.role]})</> : "Logged out"}</span>
            <button type="button" className="devpanel-x" aria-label="Close" onClick={() => setOpen(false)}>✕</button>
          </div>
          {me && ROLE_GUIDE[me.role] && (
            <div className={`devpanel-guide r-${me.role.toLowerCase()}`}>
              <p><b>{ROLE_LABEL[me.role]}:</b> {ROLE_GUIDE[me.role].what}</p>
              <div>{ROLE_GUIDE[me.role].links.map(([href, label]) => <a key={href} href={href}>{label} →</a>)}</div>
            </div>
          )}
          {state && !me && (
            <div className="devpanel-guide"><p><b>Logged out:</b> you see the site like a visitor. Pick an account below.</p></div>
          )}
          <div className="devpanel-tabs">
            <button type="button" className={tab === "accounts" ? "on" : ""} onClick={() => setTab("accounts")}>Switch account</button>
            <button type="button" className={tab === "messages" ? "on" : ""} onClick={() => setTab("messages")}>SMS &amp; email</button>
          </div>

          {tab === "accounts" ? (
            <>
              <div className="devpanel-tools">
                <input className="input" placeholder="Filter by name, role, email…" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter accounts" />
                <button type="button" className="btn btn-outline btn-sm" disabled={!state?.meId || !!busy} onClick={() => switchTo(null)}>Log out</button>
              </div>
              <ul className="devpanel-list">
                {!state && <li className="muted">Loading…</li>}
                {users.map((u) => (
                  <li key={u.id}>
                    <button type="button" disabled={u.id === state?.meId || u.status !== "ACTIVE" || !!busy} onClick={() => switchTo(u.id)}>
                      <span className={`devpanel-role r-${u.role.toLowerCase()}`}>{ROLE_LABEL[u.role]}</span>
                      <span className="devpanel-name">
                        {u.name}
                        {u.verifiedAgent && " ✓"}
                        <small>{u.contact}{u.listings ? ` · ${u.listings} listing${u.listings === 1 ? "" : "s"}` : ""}{u.status !== "ACTIVE" ? ` · ${u.status.toLowerCase()}` : ""}</small>
                      </span>
                      {u.id === state?.meId ? <em>current</em> : busy === u.id ? <em>switching…</em> : null}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <ul className="devpanel-msgs">
              {state?.messages.length === 0 && <li className="muted">Nothing sent yet.</li>}
              {state?.messages.map((m) => (
                <li key={m.id}>
                  <div className="devpanel-msg-meta">{m.channel} → {m.to} · {new Date(m.createdAt).toLocaleTimeString()}</div>
                  {m.subject && <strong>{m.subject}</strong>}
                  <p>{m.body}</p>
                </li>
              ))}
            </ul>
          )}
          <p className="devpanel-foot">Only on local test sites (DEV_TOOLS=1). A live site refuses to start with this on.</p>
        </div>
      )}
      <button type="button" className="devpanel-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        {open ? "Close dev" : me ? <>Dev · <span className={`devpanel-role r-${me.role.toLowerCase()}`}>{ROLE_LABEL[me.role]}</span> {me.name}</> : "Dev · logged out"}
      </button>
    </div>
  );
}
