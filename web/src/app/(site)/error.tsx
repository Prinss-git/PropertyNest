"use client";
import Link from "next/link";
import { useEffect } from "react";

// Shown inside the normal header and footer when a page fails unexpectedly.
export default function SiteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error]);
  return (
    <main className="container" style={{ paddingBlock: 60 }}>
      <div className="empty">
        <h3>Something went wrong on our side</h3>
        <p>Please try again. If it keeps happening, tell us what you were doing and we&apos;ll fix it.</p>
        <div className="inline-row" style={{ justifyContent: "center" }}>
          <button type="button" className="btn btn-brand" onClick={reset}>Try again</button>
          <Link className="btn btn-outline" href="/contact">Contact support</Link>
        </div>
        {error.digest && <p className="fine" style={{ marginTop: 12 }}>Error reference: {error.digest}</p>}
      </div>
    </main>
  );
}
