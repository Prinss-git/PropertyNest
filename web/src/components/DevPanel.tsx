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

export function DevPanel() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"accounts" | "messages">("accounts");
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const load = () => fetch("/api/dev/state", { cache: "no-store" }).then((r) => r.json()).then(setState).catch(() => {});
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
        {open ? "Close dev" : "Dev"}
      </button>
    </div>
  );
}
