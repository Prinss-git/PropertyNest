import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/Icon";

export const metadata: Metadata = { title: "List your property" };

// Posting requires accounts (owner / agent verification), which ship in Phase 1.
export default function PostPage() {
  return (
    <>
      <div className="page-head">
        <div className="container">
          <div className="breadcrumb"><Link href="/">Home</Link> / List property</div>
          <h1>List your property</h1>
        </div>
      </div>
      <main className="container" style={{ paddingBlock: "28px 64px" }}>
        <div className="empty">
          <Icon name="key" size={40} />
          <h3>Property posting is coming soon</h3>
          <p>Owners and licensed agents will be able to sign in and post listings to sell, rent out, or lease.</p>
          <Link className="btn btn-outline" href="/listings">Browse listings</Link>
        </div>
      </main>
    </>
  );
}
