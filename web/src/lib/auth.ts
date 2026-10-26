import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { Role } from "@prisma/client";
import { db } from "./db";

const COOKIE = "pn_session";
/** Sessions last 30 days from sign-in. Server components can't rewrite cookies, so there is no sliding renewal. */
const SESSION_DAYS = 30;

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export async function createSession(userId: string, meta: { userAgent?: string | null; ipHash?: string | null } = {}) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 864e5);
  await db.session.create({
    data: { userId, tokenHash: sha256(token), expiresAt, userAgent: meta.userAgent?.slice(0, 200), ipHash: meta.ipHash },
  });
  await db.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    // HTTPS-only once the site runs on https (always in production); plain http for local testing.
    secure: (process.env.SITE_URL ?? "").startsWith("https://"),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: sha256(token) } });
  jar.delete(COOKIE);
}

export type CurrentUser = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  role: Role;
  agent: { prcLicenseNo: string | null; licenseVerifiedAt: Date | null; agencyId: string | null } | null;
};

/** The signed-in user, or null. Cached per request, so calling it from several components costs one query. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: {
      user: {
        select: {
          id: true, name: true, phone: true, email: true, role: true, status: true,
          agentProfile: { select: { prcLicenseNo: true, licenseVerifiedAt: true, agencyId: true } },
        },
      },
    },
  });
  if (!session || session.expiresAt < new Date() || session.user.status !== "ACTIVE") return null;
  const u = session.user;
  return { id: u.id, name: u.name, phone: u.phone, email: u.email, role: u.role, agent: u.agentProfile };
});

export const STAFF_ROLES: Role[] = ["MODERATOR", "ADMIN"];
export const POSTER_ROLES: Role[] = ["OWNER", "AGENT", "AGENCY_ADMIN"];

/** For pages: sends visitors to /login (and back here afterwards) when they aren't signed in or lack a role. */
export async function requireUser(opts: { roles?: Role[]; next?: string } = {}): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login${opts.next ? `?next=${encodeURIComponent(opts.next)}` : ""}`);
  if (opts.roles && !opts.roles.includes(user.role)) redirect("/account?denied=1");
  return user;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** For API routes: throws HttpError(401/403) instead of redirecting. */
export async function apiUser(roles?: Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, "Please sign in first.");
  if (roles && !roles.includes(user.role)) throw new HttpError(403, "Your account can't do that.");
  return user;
}
