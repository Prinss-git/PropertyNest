import "server-only";
import type { Role } from "@prisma/client";
import { revalidatePath, revalidateTag } from "next/cache";
import { HttpError, type CurrentUser } from "./auth";
import { db } from "./db";
import { enqueue } from "./jobs";

const STAFF: Role[] = ["MODERATOR", "ADMIN"];
/** Roles an admin can hand out here. Agents sign up themselves with a PRC license, so AGENT isn't in this list. */
export const ASSIGNABLE_ROLES = ["SEEKER", "OWNER", "MODERATOR", "ADMIN"] as const;

async function target(actor: CurrentUser, userId: string) {
  if (userId === actor.id) throw new HttpError(400, "You can't do that to your own account.");
  const u = await db.user.findUnique({ where: { id: userId }, select: { id: true, role: true, status: true, name: true, phone: true, email: true } });
  if (!u || u.status === "DELETED") throw new HttpError(404, "User not found.");
  // Moderators handle ordinary accounts; only admins can act on staff.
  if (STAFF.includes(u.role) && actor.role !== "ADMIN") throw new HttpError(403, "Only an admin can change a staff account.");
  return u;
}

/** Suspends an account: signs it out everywhere and pulls its live listings back into the review queue. */
export async function suspendUser(actor: CurrentUser, userId: string, reason: string) {
  const u = await target(actor, userId);
  if (u.status === "SUSPENDED") throw new HttpError(409, "This account is already suspended.");
  const live = await db.listing.findMany({ where: { posterId: userId, status: "ACTIVE" }, select: { id: true, refCode: true } });
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { status: "SUSPENDED", statusReason: reason } });
    await tx.session.deleteMany({ where: { userId } });
    if (live.length) {
      await tx.listing.updateMany({
        where: { id: { in: live.map((l) => l.id) } },
        data: { status: "PENDING", moderationFlags: [{ code: "poster_suspended", message: `Poster suspended: ${reason}` }] },
      });
    }
    await tx.auditLog.create({ data: { actorId: actor.id, action: "user.suspend", entityType: "User", entityId: userId, data: { reason, listingsHidden: live.length } } });
    // The person is told why, in general terms, and how to appeal.
    const notice = "PropertyNest: Your account has been suspended for breaking our listing rules. To appeal, reply to support@propertynest.ph.";
    if (u.phone) await enqueue("sms.send", { to: u.phone, body: notice }, { tx });
    if (u.email) await enqueue("email.send", { to: u.email, subject: "Your PropertyNest account is suspended", text: `Hi ${u.name},\n\n${notice.replace("PropertyNest: ", "")}` }, { tx });
  });
  for (const l of live) revalidatePath(`/property/${l.refCode}`);
  revalidateTag("listings");
  revalidatePath("/");
  return { listingsHidden: live.length };
}

/** Lifts a suspension. Their listings stay in the review queue so a moderator re-approves each one. */
export async function reactivateUser(actor: CurrentUser, userId: string) {
  const u = await target(actor, userId);
  if (u.status !== "SUSPENDED") throw new HttpError(409, "This account isn't suspended.");
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { status: "ACTIVE", statusReason: null } }),
    db.auditLog.create({ data: { actorId: actor.id, action: "user.reactivate", entityType: "User", entityId: userId } }),
  ]);
}

export async function setUserRole(actor: CurrentUser, userId: string, role: (typeof ASSIGNABLE_ROLES)[number]) {
  if (actor.role !== "ADMIN") throw new HttpError(403, "Only an admin can change roles.");
  const u = await target(actor, userId);
  if (u.role === role) return;
  if (u.role === "AGENT") throw new HttpError(400, "Agent accounts are tied to a PRC license. Suspend the account instead of changing its role.");
  if (u.role === "ADMIN" && (await db.user.count({ where: { role: "ADMIN", status: "ACTIVE" } })) <= 1) {
    throw new HttpError(400, "This is the last admin. Make someone else an admin first.");
  }
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { role } }),
    // Role changes take effect on the next sign-in; end current sessions so old permissions don't linger.
    db.session.deleteMany({ where: { userId } }),
    db.auditLog.create({ data: { actorId: actor.id, action: "user.role_change", entityType: "User", entityId: userId, data: { from: u.role, to: role } } }),
  ]);
}
