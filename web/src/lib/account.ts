import "server-only";
import { cookies } from "next/headers";
import { Prisma } from "@prisma/client";
import { HttpError, type CurrentUser } from "./auth";
import { db } from "./db";
import { sendVerifyEmail } from "./emailAuth";
import { checkOtp, consumeOtp, requestOtp } from "./otp";
import { hashPassword, passwordProblem, verifyPassword } from "./password";
import { deleteObject } from "./storage";

const isUnique = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

/** Name and email. A new email has to be confirmed again (posting needs a confirmed email or phone). */
export async function updateProfile(user: CurrentUser, input: { name?: string; email?: string | null }) {
  const current = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { email: true, passwordHash: true } });
  const emailChanged = input.email !== undefined && (input.email ?? null) !== current.email;
  if (emailChanged && !input.email && current.passwordHash) {
    throw new HttpError(400, "You log in with your email and password, so you can't remove your email. Change it instead.");
  }
  try {
    await db.user.update({
      where: { id: user.id },
      data: {
        ...(input.name ? { name: input.name } : {}),
        ...(emailChanged ? { email: input.email || null, emailVerifiedAt: null } : {}),
      },
    });
  } catch (e) {
    if (isUnique(e)) throw new HttpError(409, "Another account already uses that email.");
    throw e;
  }
  if (emailChanged && input.email) await sendVerifyEmail(user.id, input.email, input.name ?? user.name);
  await db.auditLog.create({
    data: { actorId: user.id, action: "user.profile_update", entityType: "User", entityId: user.id, data: { nameChanged: !!input.name, emailChanged } },
  });
  return { emailChanged };
}

/** Sets a password (for phone or Google accounts) or changes it (needs the current one). */
export async function setPassword(user: CurrentUser, currentPassword: string | undefined, newPassword: string) {
  const u = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { email: true, passwordHash: true } });
  if (!u.email) throw new HttpError(400, "Add an email address first. You'll log in with your email and this password.");
  if (u.passwordHash && !(await verifyPassword(currentPassword ?? "", u.passwordHash))) {
    throw new HttpError(401, "Your current password is incorrect.");
  }
  const problem = passwordProblem(newPassword, { email: u.email, name: user.name });
  if (problem) throw new HttpError(400, problem);
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(newPassword) } });
  await db.auditLog.create({ data: { actorId: user.id, action: u.passwordHash ? "user.password_change" : "user.password_set", entityType: "User", entityId: user.id } });
}

/** Step 1 of changing the mobile number: text a code to the new number. */
export async function startPhoneChange(user: CurrentUser, phone: string, ipHash: string) {
  const taken = await db.user.findFirst({ where: { phone, id: { not: user.id } }, select: { id: true } });
  if (taken) throw new HttpError(409, "Another account already uses that number.");
  return requestOtp(phone, ipHash);
}

/** Step 2: the code proves the number is theirs. */
export async function confirmPhoneChange(user: CurrentUser, phone: string, code: string) {
  const otpId = await checkOtp(phone, code);
  try {
    await db.user.update({ where: { id: user.id }, data: { phone, phoneVerifiedAt: new Date() } });
  } catch (e) {
    if (isUnique(e)) throw new HttpError(409, "Another account already uses that number.");
    throw e;
  }
  await consumeOtp(otpId);
  // Agents' public contact number follows their verified number.
  await db.agentProfile.updateMany({ where: { userId: user.id }, data: { publicPhone: phone } });
  await db.auditLog.create({ data: { actorId: user.id, action: "user.phone_change", entityType: "User", entityId: user.id } });
}

/** Seekers and owners can switch to an agent account; the PRC license is checked by a moderator. */
export async function becomeAgent(user: CurrentUser, prcLicenseNo: string) {
  if (!["SEEKER", "OWNER", "AGENT"].includes(user.role)) throw new HttpError(403, "Staff accounts can't become agent accounts.");
  if (user.role === "AGENT" && user.agent?.licenseVerifiedAt) throw new HttpError(409, "Your license is already verified. Contact support to change it.");
  const prc = prcLicenseNo.toUpperCase();
  try {
    await db.$transaction([
      db.agentProfile.upsert({
        where: { userId: user.id },
        create: { userId: user.id, prcLicenseNo: prc, publicPhone: user.phone },
        update: { prcLicenseNo: prc, licenseVerifiedAt: null },
      }),
      db.user.update({ where: { id: user.id }, data: { role: "AGENT" } }),
      db.auditLog.create({ data: { actorId: user.id, action: "user.become_agent", entityType: "User", entityId: user.id, data: { prcLicenseNo: prc } } }),
    ]);
  } catch (e) {
    if (isUnique(e)) throw new HttpError(409, "That PRC license number is already registered to another account.");
    throw e;
  }
}

/** Everything we hold about the user, for the Data Privacy Act right of access. */
export async function exportData(userId: string) {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true, name: true, email: true, phone: true, role: true, status: true, createdAt: true, lastLoginAt: true,
      emailVerifiedAt: true, phoneVerifiedAt: true,
      agentProfile: { select: { prcLicenseNo: true, licenseVerifiedAt: true, bio: true, publicPhone: true, agency: { select: { name: true } } } },
    },
  });
  const [listings, inquiriesSent, favorites, savedSearches, sessions, reports] = await Promise.all([
    db.listing.findMany({
      where: { posterId: userId },
      select: {
        refCode: true, mode: true, type: true, status: true, title: true, description: true, price: true, address: true,
        createdAt: true, publishedAt: true, expiresAt: true, viewCount: true, inquiryCount: true,
        photos: { select: { storageKey: true } },
        inquiries: { select: { name: true, email: true, phone: true, message: true, status: true, createdAt: true } },
      },
    }),
    db.inquiry.findMany({ where: { senderId: userId }, select: { listing: { select: { refCode: true } }, message: true, createdAt: true } }),
    db.favorite.findMany({ where: { userId }, select: { listing: { select: { refCode: true } }, createdAt: true } }),
    db.savedSearch.findMany({ where: { userId }, select: { name: true, query: true, alertFrequency: true, createdAt: true } }),
    db.session.findMany({ where: { userId }, select: { userAgent: true, createdAt: true, expiresAt: true } }),
    db.report.findMany({ where: { reporterId: userId }, select: { listing: { select: { refCode: true } }, reason: true, details: true, createdAt: true } }),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    note: "Your PropertyNest data. Password hashes and security tokens are never included.",
    user,
    listings: listings.map((l) => ({ ...l, price: l.price.toNumber() })),
    inquiriesSent,
    favorites,
    savedSearches,
    activeSessions: sessions,
    reportsFiled: reports,
  };
}

/**
 * Deletes the account (Data Privacy Act right to erasure). Personal details are removed, listings come off
 * the site, and the user row stays only as an anonymous "Deleted user" so moderation records still add up.
 */
export async function deleteAccount(user: CurrentUser, password: string | undefined) {
  const u = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true } });
  if (u.passwordHash && !(await verifyPassword(password ?? "", u.passwordHash))) {
    throw new HttpError(401, "Your password is incorrect.");
  }
  const uploads = await db.upload.findMany({ where: { userId: user.id }, select: { storageKey: true } });
  await db.$transaction(async (tx) => {
    await tx.listing.updateMany({ where: { posterId: user.id, status: { not: "ARCHIVED" } }, data: { status: "ARCHIVED", address: null } });
    // Inquiries this person sent stay with the agent as a record, without their contact details.
    await tx.inquiry.updateMany({ where: { senderId: user.id }, data: { senderId: null, name: "Deleted user", email: "deleted@users.propertynest.invalid", phone: null, company: null } });
    await tx.favorite.deleteMany({ where: { userId: user.id } });
    await tx.savedSearch.deleteMany({ where: { userId: user.id } });
    await tx.authToken.deleteMany({ where: { userId: user.id } });
    await tx.upload.deleteMany({ where: { userId: user.id } });
    await tx.agentProfile.deleteMany({ where: { userId: user.id } });
    await tx.session.deleteMany({ where: { userId: user.id } });
    await tx.user.update({
      where: { id: user.id },
      data: {
        status: "DELETED", name: "Deleted user", email: null, phone: null, passwordHash: null, googleId: null,
        avatarUrl: null, emailVerifiedAt: null, phoneVerifiedAt: null,
      },
    });
    await tx.auditLog.create({ data: { actorId: user.id, action: "user.delete", entityType: "User", entityId: user.id } });
  });
  for (const up of uploads) {
    await deleteObject(up.storageKey);
    await deleteObject(up.storageKey.replace(/\.webp$/, "-sm.webp"));
  }
  (await cookies()).delete("pn_session");
}
