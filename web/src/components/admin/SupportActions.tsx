"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "../toast";

export function SupportActions({ id, status, email, subject }: { id: string; status: string; email: string; subject: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const set = async (next: string) => {
    setBusy(true);
    const res = await fetch(`/api/admin/contact/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next }) });
    setBusy(false);
    if (!res.ok) return toast("Couldn't update the message.");
    router.refresh();
  };
  return (
    <div className="row-actions">
      <a className="btn btn-brand btn-sm" href={`mailto:${email}?subject=${encodeURIComponent(`Re: ${subject}`)}`}>Reply by email</a>
      {status === "OPEN" && <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => set("ANSWERED")}>Mark answered</button>}
      {status !== "CLOSED" && <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => set("CLOSED")}>Close</button>}
      {status !== "OPEN" && <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => set("OPEN")}>Reopen</button>}
    </div>
  );
}
