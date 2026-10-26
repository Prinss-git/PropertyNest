import Link from "next/link";

/** Shared layout for policy pages. Final wording must come from a lawyer before launch. */
export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <div className="page-head">
        <div className="container">
          <div className="breadcrumb"><Link href="/">Home</Link> / {title}</div>
          <h1>{title}</h1>
        </div>
      </div>
      <main className="container legal">
        <p className="notice">Draft outline for development. The final text will be reviewed by legal counsel before PropertyNest launches.</p>
        {children}
      </main>
    </>
  );
}
