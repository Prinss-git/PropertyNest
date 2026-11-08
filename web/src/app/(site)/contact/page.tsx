import type { Metadata } from "next";
import Link from "next/link";
import { supportEmail } from "@/lib/support";
import { ContactForm } from "./ContactForm";

export const metadata: Metadata = { title: "Contact us", description: "Get help with your PropertyNest account or listing, report a scam, or reach our team." };

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ topic?: string; listing?: string }> }) {
  const { topic, listing } = await searchParams;
  return (
    <>
      <div className="page-head">
        <div className="container">
          <div className="breadcrumb"><Link href="/">Home</Link> / Contact</div>
          <h1>Contact us</h1>
          <p className="muted" style={{ margin: "4px 0 0" }}>
            Many answers are already in the <Link href="/help">Help center</Link>. For anything else, send us a message.
          </p>
        </div>
      </div>
      <main className="container settings">
        <div className="notice">
          <strong>Never pay a reservation fee or deposit before you have seen the property and verified the agent.</strong>{" "}
          If someone asks you to, choose &quot;Report a scam&quot; below.
        </div>
        <section className="settings-card">
          <h2>Send us a message</h2>
          <ContactForm initialTopic={topic} listingRef={listing} />
        </section>
        {supportEmail() && <p className="muted">You can also email <a href={`mailto:${supportEmail()}`}>{supportEmail()}</a>.</p>}
      </main>
    </>
  );
}
