"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "../toast";

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Action failed.");
}

/** Approve / ask for changes / take down. Reasons are sent to the poster by SMS. */
export function ReviewActions({ refCode, mode = "queue" }: { refCode: string; mode?: "queue" | "report" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<"reject" | "takedown" | null>(null);
  const [reason, setReason] = useState("");

  async function decide(decision: "approve" | "reject" | "takedown") {
    setBusy(true);
    try {
      await post(`/api/admin/listings/${refCode}`, decision === "approve" ? { decision } : { decision, reason });
      toast(decision === "approve" ? (mode === "report" ? "Reports dismissed" : "Approved: listing is live") : decision === "reject" ? "Sent back to the poster" : "Listing taken down");
      setPending(null);
      setReason("");
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (pending) {
    return (
      <form className="review-reason" onSubmit={(e) => { e.preventDefault(); decide(pending); }}>
        <input className="input" autoFocus value={reason} onChange={(e) => setReason(e.target.value)} minLength={5} required
          placeholder={pending === "reject" ? "What should the poster fix? (sent by SMS)" : "Reason for takedown (sent by SMS)"} />
        <button className="btn btn-sm btn-brand" disabled={busy}>{pending === "reject" ? "Send back" : "Take down"}</button>
        <button type="button" className="btn btn-sm btn-outline" onClick={() => setPending(null)}>Cancel</button>
      </form>
    );
  }
  return (
    <div className="row-actions">
      <button className="btn btn-sm btn-brand" disabled={busy} onClick={() => decide("approve")}>{mode === "report" ? "Dismiss reports" : "Approve"}</button>
      {mode === "queue" && <button className="btn btn-sm btn-outline" disabled={busy} onClick={() => setPending("reject")}>Ask for changes</button>}
      <button className="btn btn-sm btn-outline danger" disabled={busy} onClick={() => setPending("takedown")}>Take down</button>
    </div>
  );
}

export function AgentVerifyActions({ userId }: { userId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function decide(verified: boolean) {
    setBusy(true);
    try {
      await post(`/api/admin/agents/${userId}`, { verified, note: verified ? undefined : "The number doesn't match the PRC registry." });
      toast(verified ? "Agent verified" : "Agent notified");
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="row-actions">
      <button className="btn btn-sm btn-brand" disabled={busy} onClick={() => decide(true)}>License checks out</button>
      <button className="btn btn-sm btn-outline danger" disabled={busy} onClick={() => decide(false)}>Doesn&apos;t match</button>
    </div>
  );
}
