"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "../toast";

const CLOSE_REASON = { buy: "SOLD", rent: "RENTED", lease: "LEASED" } as const;
const CLOSE_LABEL = { buy: "Mark as sold", rent: "Mark as rented", lease: "Mark as leased" } as const;

/** Edit / close / renew / archive buttons for one of the poster's own listings. */
export function ListingActions({ refCode, status, mode }: { refCode: string; status: string; mode: "buy" | "rent" | "lease" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<"close" | "archive" | null>(null);

  async function act(action: "close" | "renew" | "archive") {
    setBusy(true);
    try {
      const res = await fetch(`/api/my/listings/${refCode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason: action === "close" ? CLOSE_REASON[mode] : undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return toast(data.error ?? "Couldn't update the listing.");
      toast(action === "renew" ? "Listing renewed" : action === "close" ? "Listing closed" : "Listing archived");
      router.refresh();
    } finally {
      setBusy(false);
      setConfirming(null);
    }
  }

  if (confirming) {
    return (
      <div className="row-actions">
        <span className="muted" style={{ fontSize: 13 }}>{confirming === "close" ? `${CLOSE_LABEL[mode]}? It leaves search.` : "Archive? This can't be undone."}</span>
        <button className="btn btn-sm btn-brand" disabled={busy} onClick={() => act(confirming)}>Confirm</button>
        <button className="btn btn-sm btn-outline" onClick={() => setConfirming(null)}>Cancel</button>
      </div>
    );
  }
  return (
    <div className="row-actions">
      {["ACTIVE", "PENDING", "REJECTED", "EXPIRED", "DRAFT"].includes(status) && <Link className="btn btn-sm btn-outline" href={`/account/listings/${refCode}/edit`}>Edit</Link>}
      {["ACTIVE", "EXPIRED"].includes(status) && <button className="btn btn-sm btn-outline" disabled={busy} onClick={() => act("renew")}>Renew</button>}
      {status === "ACTIVE" && <button className="btn btn-sm btn-outline" disabled={busy} onClick={() => setConfirming("close")}>{CLOSE_LABEL[mode]}</button>}
      {status !== "ARCHIVED" && <button className="btn btn-sm btn-outline" disabled={busy} onClick={() => setConfirming("archive")}>Archive</button>}
    </div>
  );
}
