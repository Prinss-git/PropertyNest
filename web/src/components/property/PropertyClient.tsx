"use client";
import { useEffect, useState } from "react";
import { Icon } from "../Icon";
import { toast } from "../toast";

export function Gallery({ photos, title, icon }: { photos: string[]; title: string; icon: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const shown = photos.slice(0, 5);

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") setOpen((i) => (i! + 1) % photos.length);
      if (e.key === "ArrowLeft") setOpen((i) => (i! - 1 + photos.length) % photos.length);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, photos.length]);

  if (!photos.length) {
    return <div className="gallery n1"><div className="g"><span className="ph-icon"><Icon name={icon} size={64} /></span></div></div>;
  }
  return (
    <>
      <div className={`gallery n${shown.length}`}>
        {shown.map((src, i) => (
          <button type="button" key={src + i} className="g" onClick={() => setOpen(i)} aria-label={`Open photo ${i + 1} of ${photos.length}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={i === 0 ? title : `Photo ${i + 1}`} />
            {i === 4 && photos.length > 5 && <span className="more">+{photos.length - 5} photos</span>}
          </button>
        ))}
      </div>
      {open !== null && (
        <div className="lightbox" role="dialog" aria-modal="true" onClick={(e) => e.target === e.currentTarget && setOpen(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photos[open]} alt={`Photo ${open + 1}`} />
          <button className="lb-close" aria-label="Close" onClick={() => setOpen(null)}>✕</button>
          <button className="lb-prev" aria-label="Previous" onClick={() => setOpen((open - 1 + photos.length) % photos.length)}>‹</button>
          <button className="lb-next" aria-label="Next" onClick={() => setOpen((open + 1) % photos.length)}>›</button>
          <div className="lb-count">{open + 1} / {photos.length}</div>
        </div>
      )}
    </>
  );
}

export function ShareButton() {
  return (
    <button type="button" className="btn btn-outline btn-sm" onClick={async () => {
      try {
        await navigator.clipboard.writeText(location.href);
        toast("Link copied to clipboard");
      } catch {
        toast("Couldn't copy automatically. Copy the link from your address bar.");
      }
    }}>
      <Icon name="share" size={16} /> Share
    </button>
  );
}

export function PhoneReveal({ phone }: { phone: string }) {
  const [shown, setShown] = useState(false);
  return shown ? (
    <a className="btn btn-outline btn-block" href={`tel:${phone.replace(/\s/g, "")}`}><Icon name="phone" size={16} /> {phone}</a>
  ) : (
    <button type="button" className="btn btn-outline btn-block" onClick={() => setShown(true)}><Icon name="phone" size={16} /> Show phone number</button>
  );
}

export function InquiryForm({ refCode, mode, agentName }: { refCode: string; mode: "buy" | "rent" | "lease"; agentName: string }) {
  const defaultMsg =
    mode === "buy" ? "I'm interested in buying this property. Is it still available? I'd like to schedule a viewing."
    : mode === "rent" ? "Hi! I'd like to rent this unit. Is it still available, and when can I view it?"
    : "Hello, our company is interested in leasing this space. Could you share the lease terms and availability?";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingRef: refCode, ...Object.fromEntries(new FormData(form)) }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Couldn't send your inquiry. Please try again.");
        return;
      }
      form.reset();
      toast(`Inquiry sent to ${agentName}. They'll get back to you soon.`);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
      <input className="input" name="name" placeholder="Your name" required maxLength={80} aria-label="Your name" />
      <input className="input" name="email" type="email" placeholder="Email" required maxLength={120} aria-label="Email" />
      <input className="input" name="phone" placeholder="Mobile number (+63)" maxLength={20} aria-label="Mobile number" />
      {mode === "lease" && <input className="input" name="company" placeholder="Company name (optional)" maxLength={120} aria-label="Company name" />}
      {mode !== "buy" && (
        <div className="field"><label htmlFor="inq-date">Preferred move-in date</label><input className="input" id="inq-date" type="date" name="preferredDate" /></div>
      )}
      <textarea className="textarea" name="message" rows={4} defaultValue={defaultMsg} required maxLength={2000} aria-label="Message" />
      {/* Honeypot: hidden from people, bots tend to fill it. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" style={{ position: "absolute", left: "-9999px" }} aria-hidden="true" />
      {error && <p role="alert" style={{ color: "#b42318", margin: 0, fontSize: 14 }}>{error}</p>}
      <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
        <Icon name="mail" size={16} /> {busy ? "Sending…" : "Send inquiry"}
      </button>
    </form>
  );
}
