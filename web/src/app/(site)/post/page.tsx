import type { Metadata } from "next";
import Link from "next/link";
import { ListingForm } from "@/components/listingForm/ListingForm";
import { emptyValues } from "@/lib/listingDefaults";
import { requireUser } from "@/lib/auth";
import { getCityOptions } from "@/lib/listings";

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
        <ListingForm cities={cities} initial={emptyValues(makati.id)} />
      </main>
    </>
  );
}
