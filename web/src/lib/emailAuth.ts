import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { Prisma, type AuthTokenKind } from "@prisma/client";
import { createSession, HttpError } from "./auth";
import { db } from "./db";
import { enqueue } from "./jobs";
import { hashPassword, passwordProblem, verifyPassword } from "./password";

const SITE = () => process.env.SITE_URL ?? "http://localhost:3000";
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

const WINDOW_MS = 15 * 60_000;
const MAX_FAILS_PER_EMAIL = 5;
const MAX_FAILS_PER_IP = 20;
const TOKEN_TTL: Record<AuthTokenKind, number> = { EMAIL_VERIFY: 3 * 864e5, PASSWORD_RESET: 3600e3 };

type Meta = { ipHash: string; userAgent: string | null };

async function issueToken(userId: string, kind: AuthTokenKind) {
  const token = randomBytes(32).toString("base64url");
  await db.authToken.create({ data: { userId, kind, tokenHash: sha256(token), expiresAt: new Date(Date.now() + TOKEN_TTL[kind]) } });
  return token;
}

/** Finds a still-valid one-time link token without using it up. */
async function findToken(token: string, kind: AuthTokenKind) {
  const row = await db.authToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!row || row.kind !== kind || row.usedAt || row.expiresAt < new Date()) {
    throw new HttpError(400, kind === "PASSWORD_RESET" ? "This reset link has expired or was already used. Request a new one." : "This verification link has expired or was already used.");
  }
  return row;
}

/** Validates and uses up a one-time link token. */
async function consumeToken(token: string, kind: AuthTokenKind) {
  const row = await findToken(token, kind);
  await db.authToken.update({ where: { id: row.id }, data: { usedAt: new Date() } });
  return row.userId;
}

async function sendVerifyEmail(userId: string, email: string, name: string) {
  const token = await issueToken(userId, "EMAIL_VERIFY");
  await enqueue("email.send", {
    to: email,
    subject: "Confirm your email for PropertyNest",
    text: `Hi ${name},\n\nConfirm your email so we can send you inquiry alerts and account notices:\n${SITE()}/verify-email?token=${token}\n\nThis link works for 3 days. If you didn't create a PropertyNest account, ignore this email.`,
  });
}

export async function signUpWithEmail(
  input: { name: string; email: string; password: string; role: "SEEKER" | "OWNER" | "AGENT"; prcLicenseNo?: string },
  meta: Meta,
) {
  const problem = passwordProblem(input.password, { email: input.email, name: input.name });
  if (problem) throw new HttpError(400, problem);
  if (input.role === "AGENT" && !input.prcLicenseNo) throw new HttpError(400, "Agents need a PRC license number. Choose Owner if you're listing your own property.");

  let user;
  try {
    user = await db.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash: await hashPassword(input.password),
        role: input.role,
        agentProfile: input.role === "AGENT" ? { create: { prcLicenseNo: input.prcLicenseNo!.toUpperCase() } } : undefined,
      },
      select: { id: true, name: true, email: true },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const target = String(e.meta?.target ?? "");
      throw new HttpError(409, target.includes("email") ? "An account with this email already exists. Log in or reset your password." : "That PRC license number is already registered.");
    }
    throw e;
  }
  await db.auditLog.create({ data: { actorId: user.id, action: "user.signup", entityType: "User", entityId: user.id, data: { role: input.role, method: "email" } } });
  await sendVerifyEmail(user.id, user.email!, user.name);
  await createSession(user.id, meta);
}

export async function logInWithEmail(email: string, password: string, meta: Meta) {
  const since = new Date(Date.now() - WINDOW_MS);
  const [emailFails, ipFails] = await Promise.all([
    db.loginAttempt.count({ where: { email, success: false, createdAt: { gte: since } } }),
    db.loginAttempt.count({ where: { ipHash: meta.ipHash, success: false, createdAt: { gte: since } } }),
  ]);
  if (emailFails >= MAX_FAILS_PER_EMAIL || ipFails >= MAX_FAILS_PER_IP) {
    throw new HttpError(429, "Too many failed attempts. Wait 15 minutes or reset your password.");
  }

  const user = await db.user.findUnique({ where: { email }, select: { id: true, status: true, passwordHash: true } });
  const ok = await verifyPassword(password, user?.passwordHash ?? null);
  await db.loginAttempt.create({ data: { email, ipHash: meta.ipHash, success: ok } });
  // Same message whether the email exists or not, so the form can't be used to find accounts.
  if (!user || !ok) throw new HttpError(401, "Email or password is incorrect.");
  if (user.status !== "ACTIVE") throw new HttpError(403, "This account is suspended. Contact support.");
  await createSession(user.id, meta);
}

/** Always succeeds from the caller's point of view, so it can't reveal which emails have accounts. */
export async function requestPasswordReset(email: string) {
  const user = await db.user.findUnique({ where: { email }, select: { id: true, name: true, status: true } });
  if (!user || user.status !== "ACTIVE") return;
  const recent = await db.authToken.count({ where: { userId: user.id, kind: "PASSWORD_RESET", createdAt: { gte: new Date(Date.now() - 3600e3) } } });
  if (recent >= 3) return;
  const token = await issueToken(user.id, "PASSWORD_RESET");
  await enqueue("email.send", {
    to: email,
    subject: "Reset your PropertyNest password",
    text: `Hi ${user.name},\n\nUse this link to choose a new password:\n${SITE()}/reset-password?token=${token}\n\nIt works once, for 1 hour. If you didn't ask for this, ignore this email; your password stays the same.`,
  });
}

export async function resetPassword(token: string, password: string, meta: Meta) {
  // Check the new password before using up the link, so a rejected password doesn't burn it.
  const row = await findToken(token, "PASSWORD_RESET");
  const user = await db.user.findUnique({ where: { id: row.userId }, select: { email: true, name: true } });
  const problem = passwordProblem(password, { email: user?.email ?? undefined, name: user?.name });
  if (problem) throw new HttpError(400, problem);
  const passwordHash = await hashPassword(password);
  await db.$transaction(async (tx) => {
    // Conditional update: if two requests race with the same link, only one wins.
    const used = await tx.authToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
    if (used.count === 0) throw new HttpError(400, "This reset link has expired or was already used. Request a new one.");
    await tx.user.update({ where: { id: row.userId }, data: { passwordHash, emailVerifiedAt: new Date() } });
    // A reset signs out every other device, in case someone else had access.
    await tx.session.deleteMany({ where: { userId: row.userId } });
    // Someone locked out by failed attempts shouldn't stay locked out after proving they own the email.
    if (user?.email) await tx.loginAttempt.deleteMany({ where: { email: user.email, success: false } });
    await tx.auditLog.create({ data: { actorId: row.userId, action: "user.password_reset", entityType: "User", entityId: row.userId } });
  });
  await createSession(row.userId, meta);
}

export async function verifyEmail(token: string) {
  const userId = await consumeToken(token, "EMAIL_VERIFY");
  await db.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
}
