"use client";
import { useState } from "react";
import { CONTACT_TOPICS } from "@/lib/support";

export function ContactForm({ initialTopic, listingRef }: { initialTopic?: string; listingRef?: string }) {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (sent) {
    return (
      <div className="notice ok" role="status">
        Thanks, we got your message. We reply by email, usually within one working day.
      </div>
    );
  }
  return (
    <form className="settings-form" onSubmit={async (e) => {
      e.preventDefault();
      setBusy(true);
      setError("");
      try {
        const res = await fetch("/api/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(Object.fromEntries(new FormData(e.currentTarget))),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Couldn't send your message. Please try again.");
        setSent(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    }}>
      <div className="form-grid two-col">
        <div className="field"><label htmlFor="c-name">Your name</label><input className="input" id="c-name" name="name" required minLength={2} maxLength={80} autoComplete="name" /></div>
        <div className="field"><label htmlFor="c-email">Email (we reply here)</label><input className="input" id="c-email" name="email" type="email" required maxLength={120} autoComplete="email" /></div>
        <div className="field"><label htmlFor="c-phone">Mobile number (optional)</label><input className="input" id="c-phone" name="phone" inputMode="tel" maxLength={20} autoComplete="tel" /></div>
        <div className="field"><label htmlFor="c-topic">Topic</label>
          <select className="select" id="c-topic" name="topic" defaultValue={initialTopic ?? "other"}>
            {CONTACT_TOPICS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>
      <div className="field"><label htmlFor="c-listing">Listing number (if it&apos;s about one)</label>
        <input className="input" id="c-listing" name="listingRef" defaultValue={listingRef ?? ""} placeholder="e.g. PN-10042" maxLength={20} /></div>
      <div className="field"><label htmlFor="c-msg">Message</label>
        <textarea className="textarea" id="c-msg" name="message" rows={6} required minLength={10} maxLength={4000} /></div>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" style={{ position: "absolute", left: "-9999px" }} aria-hidden="true" />
      {error && <p className="form-error" role="alert">{error}</p>}
      <div><button className="btn btn-brand" disabled={busy}>{busy ? "Sending…" : "Send message"}</button></div>
    </form>
  );
}
