"use client";

// Last resort, when even the site layout fails. Must render its own <html> and avoid the stylesheet.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#f6f8f8", color: "#1c2526", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0, padding: 16 }}>
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <h1 style={{ fontSize: 22 }}>PropertyNest is having trouble</h1>
          <p>Please try again in a minute.</p>
          <button type="button" onClick={reset} style={{ padding: "10px 20px", borderRadius: 999, border: 0, background: "#1b2a4a", color: "#fff", fontWeight: 600, cursor: "pointer" }}>Try again</button>
          {error.digest && <p style={{ fontSize: 12, color: "#5f6b6d" }}>Error reference: {error.digest}</p>}
        </div>
      </body>
    </html>
  );
}
