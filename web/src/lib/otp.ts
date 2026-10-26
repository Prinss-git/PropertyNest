import "server-only";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { HttpError } from "./auth";
import { db } from "./db";
import { sendSms } from "./messaging";

const CODE_TTL_MS = 5 * 60_000;
const RESEND_AFTER_MS = 60_000;
const MAX_PER_PHONE_PER_HOUR = 5;
const MAX_PER_IP_PER_HOUR = 15;
const MAX_ATTEMPTS = 5;

function secret() {
  const s = process.env.OTP_SECRET;
  if (!s && process.env.NODE_ENV === "production" && process.env.OTP_DEV_ECHO !== "1") {
    throw new Error("OTP_SECRET must be set in production");
  }
  return s ?? "dev-only-otp-secret";
}
const hashCode = (phone: string, code: string) => createHmac("sha256", secret()).update(`${phone}:${code}`).digest("hex");

/**
 * Sends a 6-digit code by SMS. Throttled per number (1/min, 5/hour) and per IP (15/hour)
 * so the endpoint can't be used to spam people or run up our SMS bill.
 * Returns the code itself only when OTP_DEV_ECHO=1 (local development without an SMS provider).
 */
export async function requestOtp(phone: string, ipHash: string): Promise<{ devCode?: string }> {
  const hourAgo = new Date(Date.now() - 3600e3);
  const [last, phoneCount, ipCount] = await Promise.all([
    db.otpCode.findFirst({ where: { phone }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    db.otpCode.count({ where: { phone, createdAt: { gte: hourAgo } } }),
    db.otpCode.count({ where: { ipHash, createdAt: { gte: hourAgo } } }),
  ]);
  if (last && Date.now() - last.createdAt.getTime() < RESEND_AFTER_MS) {
    const wait = Math.ceil((RESEND_AFTER_MS - (Date.now() - last.createdAt.getTime())) / 1000);
    throw new HttpError(429, `Please wait ${wait} seconds before requesting another code.`);
  }
  if (phoneCount >= MAX_PER_PHONE_PER_HOUR || ipCount >= MAX_PER_IP_PER_HOUR) {
    throw new HttpError(429, "Too many codes requested. Please try again in an hour.");
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await db.otpCode.create({ data: { phone, codeHash: hashCode(phone, code), ipHash, expiresAt: new Date(Date.now() + CODE_TTL_MS) } });
  try {
    await sendSms(phone, `${code} is your PropertyNest code. It expires in 5 minutes. Never share it with anyone, including PropertyNest staff.`);
  } catch {
    throw new HttpError(502, "We couldn't send the SMS. Check the number and try again.");
  }
  return process.env.OTP_DEV_ECHO === "1" ? { devCode: code } : {};
}

/**
 * Checks a code without using it up. Call consumeOtp() once the sign-in actually succeeds,
 * so a new user can enter the code, then their name, without requesting a second SMS.
 */
export async function checkOtp(phone: string, code: string): Promise<string> {
  const otp = await db.otpCode.findFirst({
    where: { phone, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!otp) throw new HttpError(400, "That code has expired. Request a new one.");
  if (otp.attempts >= MAX_ATTEMPTS) throw new HttpError(429, "Too many wrong attempts. Request a new code.");

  const expected = Buffer.from(otp.codeHash, "hex");
  const actual = Buffer.from(hashCode(phone, code), "hex");
  if (!timingSafeEqual(expected, actual)) {
    await db.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    const left = MAX_ATTEMPTS - otp.attempts - 1;
    throw new HttpError(400, left > 0 ? `Wrong code. ${left} attempt${left === 1 ? "" : "s"} left.` : "Wrong code. Request a new one.");
  }
  return otp.id;
}

export async function consumeOtp(otpId: string) {
  await db.otpCode.update({ where: { id: otpId }, data: { usedAt: new Date() } });
}
