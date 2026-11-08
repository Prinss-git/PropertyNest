import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Help center",
  description: "How to buy, rent or lease through PropertyNest, post a listing, verify your account, and stay safe from scams.",
};

type QA = [string, React.ReactNode];

const SECTIONS: { id: string; title: string; items: QA[] }[] = [
  {
    id: "searching",
    title: "Buying, renting and leasing",
    items: [
      ["What's the difference between Rent and Lease?", "Rent is for homes, usually 6 to 12 month contracts paid monthly with a deposit and advance. Lease is for longer contracts of a year or more, mostly offices, shops, warehouses and lots, often with a yearly rent increase (escalation)."],
      ["Why does a listing show an area instead of an exact pin?", "Many owners choose to show an approximate location of about 400 m for privacy. The agent or owner shares the exact address after you inquire."],
      ["How do I contact the agent or owner?", "Use the inquiry form on the listing. They get an SMS and an email right away, and you'll hear back by email or phone."],
      ["What does Verified mean?", "A Verified listing was checked by our team. A shield next to an agent's name means we confirmed their PRC license."],
    ],
  },
  {
    id: "posting",
    title: "Posting a listing",
    items: [
      ["Who can post?", <>Property owners (up to 3 active listings for free) and licensed agents (up to 30). Create an account, confirm your email or mobile number, then use <Link href="/post">List Property</Link>.</>],
      ["Why is my listing in review?", "First listings, unusual prices, contact details in the description, and photos used by another poster get a quick check by our team. We text you when it's live."],
      ["Why can't I put my phone number in the description?", "Inquiries go through PropertyNest so you get them as tracked leads, with an SMS and email alert, and we can stop spam and scams. Agents can also show their number with the Show phone number button on their listings."],
      ["My listing expired. What now?", <>Rentals expire after 30 days, leases after 60 and sales after 90, so search stays up to date. We remind you 3 days before. Renew it with one click from <Link href="/account">My account</Link>.</>],
      ["It's sold, rented or leased. How do I take it down?", "Open My account and choose Mark as sold, rented or leased. It leaves search and buyers stop calling."],
    ],
  },
  {
    id: "account",
    title: "Your account",
    items: [
      ["I didn't get the confirmation email.", <>Check your spam folder, then resend it from <Link href="/account/settings">Account settings</Link>. You can also add a mobile number there instead.</>],
      ["How do I become an agent account?", <>In <Link href="/account/settings">Account settings</Link>, enter your PRC license number under Account type. Our team checks it against the PRC registry.</>],
      ["How do I download or delete my data?", <>Both are in <Link href="/account/settings">Account settings</Link>, as required by the Data Privacy Act of 2012.</>],
    ],
  },
  {
    id: "safety",
    title: "Staying safe",
    items: [
      ["How do I spot a scam?", "Be careful when someone asks for a reservation fee or deposit before a viewing, pushes you to pay by GCash or remittance, refuses a video call or viewing, or offers a price far below similar listings."],
      ["What should I do if I suspect a scam?", <>Use <strong>Report this listing</strong> on the listing page, or <Link href="/contact?topic=scam">contact us</Link>. Three reports hide a listing until our team reviews it.</>],
    ],
  },
];

export default function HelpPage() {
  return (
    <>
      <div className="page-head">
        <div className="container">
          <div className="breadcrumb"><Link href="/">Home</Link> / Help</div>
          <h1>Help center</h1>
          <nav className="pill-tabs" style={{ marginTop: 14, flexWrap: "wrap" }} aria-label="Help topics">
            {SECTIONS.map((s) => <a key={s.id} href={`#${s.id}`}>{s.title}</a>)}
          </nav>
        </div>
      </div>
      <main className="container settings">
        {SECTIONS.map((s) => (
          <section key={s.id} id={s.id} className="settings-card">
            <h2>{s.title}</h2>
            <div className="faq">
              {s.items.map(([q, a]) => (
                <details key={q}>
                  <summary>{q}</summary>
                  <div className="muted">{a}</div>
                </details>
              ))}
            </div>
          </section>
        ))}
        <section className="settings-card">
          <h2>Still need help?</h2>
          <p className="muted">Send us a message and we&apos;ll reply by email, usually within one working day.</p>
          <Link className="btn btn-brand" href="/contact">Contact us</Link>
        </section>
      </main>
    </>
  );
}
