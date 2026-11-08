import type { Metadata } from "next";
import Link from "next/link";
import { ListingForm } from "@/components/listingForm/ListingForm";
import { emptyValues } from "@/lib/listingDefaults";
import { requireUser } from "@/lib/auth";
import { getCityOptions } from "@/lib/listings";
import { EmailVerifyButton } from "../account/settings/SettingsSections";

export const metadata: Metadata = { title: "List your property", robots: { index: false } };

export default async function PostPage() {
  const user = await requireUser({ next: "/post" });
  const cities = await getCityOptions();
  const makati = cities.find((c) => c.name === "Makati") ?? cities[0];

  return (
    <>
      <div className="page-head">
        <div className="container">
          <div className="breadcrumb"><Link href="/">Home</Link> / <Link href="/account">Account</Link> / List property</div>
          <h1>List your property</h1>
          <p className="muted" style={{ margin: "4px 0 0" }}>
            {user.role === "AGENT"
              ? "Post for a client. Listings show your name and agency."
              : "Sell it, rent it out, or lease it. Owners can have up to 3 active listings for free."}
          </p>
        </div>
      </div>
      <main className="container">
        {user.verified ? (
          <ListingForm cities={cities} initial={emptyValues(makati.id)} />
        ) : (
          <div className="empty" style={{ marginBlock: 28 }}>
            <h3>Confirm your email to post</h3>
            <p>
              We sent a confirmation link to <strong>{user.email}</strong>. Open it, then come back here.
              <br />
              No email? <EmailVerifyButton /> or <Link href="/account/settings">add a mobile number</Link> instead.
            </p>
          </div>
        )}
      </main>
    </>
  );
}
