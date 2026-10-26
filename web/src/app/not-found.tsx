import Link from "next/link";
import { Icon } from "@/components/Icon";

export default function NotFound() {
  return (
    <main className="container" style={{ paddingBlock: "60px" }}>
      <div className="empty">
        <Icon name="search" size={40} />
        <h3>Page not found</h3>
        <p>The listing may have been removed, or the link is incorrect.</p>
        <Link className="btn btn-outline" href="/listings">Browse all properties</Link>
      </div>
    </main>
  );
}
