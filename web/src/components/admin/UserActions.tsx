"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "../toast";

async function act(userId: string, body: unknown) {
  const res = await fetch(`/api/admin/users/${userId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Action failed.");
  return data;
}

/** Suspend / reactivate, and (admins only) role changes, for one user. */
export function UserActions({ userId, status, role, canChangeRole, canAct }: {
  userId: string; status: string; role: string; canChangeRole: boolean; canAct: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [suspending, setSuspending] = useState(false);
  const [reason, setReason] = useState("");
  const [newRole, setNewRole] = useState(role);

  async function run(body: unknown, done: (d: { listingsHidden?: number }) => string) {
    setBusy(true);
    try {
      const d = await act(userId, body);
      toast(done(d));
      setSuspending(false);
      setReason("");
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!canAct) return <p className="muted">You can&apos;t change this account (it&apos;s yours, or a staff account that only an admin can change).</p>;

  return (
    <div className="settings-form">
      {status === "SUSPENDED" ? (
        <div className="inline-row">
          <button className="btn btn-brand btn-sm" disabled={busy} onClick={() => run({ action: "reactivate" }, () => "Account reactivated. Their listings are waiting in the review queue.")}>Reactivate account</button>
        </div>
      ) : suspending ? (
        <form className="inline-row" onSubmit={(e) => { e.preventDefault(); run({ action: "suspend", reason }, (d) => `Suspended. ${d.listingsHidden ?? 0} live listing(s) pulled for review.`); }}>
          <input className="input" autoFocus value={reason} onChange={(e) => setReason(e.target.value)} minLength={5} required placeholder="Reason (staff only, e.g. asked for GCash deposit before viewing)" aria-label="Reason" />
          <button className="btn btn-sm danger-solid" disabled={busy}>Suspend</button>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setSuspending(false)}>Cancel</button>
        </form>
      ) : (
        <div className="inline-row">
          <button className="btn btn-outline btn-sm danger" onClick={() => setSuspending(true)}>Suspend account</button>
          <span className="fine">Signs them out, hides their live listings for review, and tells them how to appeal.</span>
        </div>
      )}
      {canChangeRole && role !== "AGENT" && (
        <div className="inline-row">
          <select className="select" value={newRole} onChange={(e) => setNewRole(e.target.value)} aria-label="Role" style={{ width: "auto" }}>
            <option value="SEEKER">Seeker</option>
            <option value="OWNER">Owner</option>
            <option value="MODERATOR">Moderator</option>
            <option value="ADMIN">Admin</option>
          </select>
          <button className="btn btn-outline btn-sm" disabled={busy || newRole === role} onClick={() => run({ action: "role", role: newRole }, () => "Role changed. They'll need to log in again.")}>Change role</button>
        </div>
      )}
    </div>
  );
}
