import Link from "next/link";
import { timeAgo } from "@/lib/catalog";

const LABELS: Record<string, string> = {
  "listing.": "Listings",
  "user.": "Accounts",
  "agent.": "Agent licenses",
  "listing.create": "Posted a listing",
  "listing.update": "Edited a listing",
  "listing.approve": "Approved a listing",
  "listing.reject": "Asked for changes",
  "listing.takedown": "Took down a listing",
  "listing.close": "Closed a listing",
  "listing.renew": "Renewed a listing",
  "listing.archive": "Archived a listing",
  "listing.expire": "Listing expired",
  "user.signup": "Signed up",
  "user.profile_update": "Updated profile",
  "user.password_set": "Set a password",
  "user.password_change": "Changed password",
  "user.password_reset": "Reset password by email",
  "user.phone_change": "Changed mobile number",
  "user.google_link": "Connected Google",
  "user.become_agent": "Switched to an agent account",
  "user.delete": "Deleted their account",
  "user.suspend": "Suspended an account",
  "user.reactivate": "Reactivated an account",
  "user.role_change": "Changed a role",
  "agent.verify": "Verified a PRC license",
  "agent.reject": "Rejected a PRC license",
};

export const auditLabel = (action: string) => LABELS[action] ?? action;

/** Short, readable summary of an audit entry's extra data (reasons, role changes, flags). */
function details(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const d = data as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof d.reason === "string") parts.push(`“${d.reason}”`);
  if (d.from && d.to) parts.push(`${String(d.from).toLowerCase()} → ${String(d.to).toLowerCase()}`);
  if (typeof d.role === "string") parts.push(`as ${d.role.toLowerCase()}`);
  if (typeof d.method === "string") parts.push(`with ${d.method}`);
  if (typeof d.status === "string") parts.push(`→ ${d.status.toLowerCase()}`);
  if (Array.isArray(d.flags) && d.flags.length) parts.push(`flags: ${d.flags.join(", ")}`);
  if (typeof d.prcLicenseNo === "string") parts.push(`PRC ${d.prcLicenseNo}`);
  if (typeof d.listingsHidden === "number" && d.listingsHidden) parts.push(`${d.listingsHidden} listing(s) pulled for review`);
  return parts.join(" · ");
}

type Row = {
  id: string; action: string; entityType: string; entityId: string; data: unknown; createdAt: Date;
  actor: { id: string; name: string; role: string } | null;
};

export function AuditRow({ row, listing, user }: { row: Row; listing?: { refCode: string; status: string }; user?: { id: string; name: string } }) {
  const target =
    row.entityType === "Listing"
      ? listing ? (listing.status === "ACTIVE" ? <Link href={`/property/${listing.refCode}`}>{listing.refCode}</Link> : listing.refCode) : "listing"
      : row.entityType === "User"
        ? user ? <Link href={`/admin/users/${user.id}`}>{user.name}</Link> : "user"
        : row.entityType;
  return (
    <tr>
      <td>{timeAgo(row.createdAt)}<br /><span className="muted">{row.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC</span></td>
      <td>{row.actor ? <Link href={`/admin/users/${row.actor.id}`}>{row.actor.name}</Link> : <span className="muted">System</span>}</td>
      <td>{auditLabel(row.action)}{details(row.data) && <div className="muted">{details(row.data)}</div>}</td>
      <td>{target}</td>
    </tr>
  );
}
