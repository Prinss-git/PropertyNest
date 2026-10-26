// SMS and email delivery. Imported by both the web app and the worker, so no Next.js-only imports here.
import { db } from "./db";

type Sent = { provider: string; providerRef?: string };

// ── SMS ──
// SMS_PROVIDER=console (default, dev: logs only) | semaphore (Philippine SMS gateway, semaphore.co)
async function smsViaSemaphore(to: string, body: string): Promise<Sent> {
  const key = process.env.SEMAPHORE_API_KEY;
  if (!key) throw new Error("SEMAPHORE_API_KEY is not set");
  const form = new URLSearchParams({ apikey: key, number: to.replace(/^\+/, ""), message: body });
  if (process.env.SEMAPHORE_SENDER) form.set("sendername", process.env.SEMAPHORE_SENDER);
  const res = await fetch("https://api.semaphore.co/api/v4/messages", { method: "POST", body: form, signal: AbortSignal.timeout(15000) });
  const data = await res.json().catch(() => null);
  if (!res.ok || !Array.isArray(data) || !data[0]?.message_id) throw new Error(`Semaphore error ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
  return { provider: "semaphore", providerRef: String(data[0].message_id) };
}

export async function sendSms(to: string, body: string): Promise<void> {
  const provider = process.env.SMS_PROVIDER ?? "console";
  try {
    const sent = provider === "semaphore" ? await smsViaSemaphore(to, body) : (console.log(`[sms → ${to}] ${body}`), { provider: "console" });
    await db.outboundMessage.create({ data: { channel: "SMS", to, body, status: "SENT", ...sent } });
  } catch (e) {
    await db.outboundMessage.create({ data: { channel: "SMS", to, body, status: "FAILED", provider, error: String(e).slice(0, 500) } });
    throw e;
  }
}

// ── Email ──
// EMAIL_PROVIDER=console (default) | resend (resend.com)
async function emailViaResend(to: string, subject: string, text: string): Promise<Sent> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM ?? "PropertyNest <noreply@propertynest.ph>", to, subject, text }),
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.id) throw new Error(`Resend error ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
  return { provider: "resend", providerRef: data.id };
}

export async function sendEmail(to: string, subject: string, text: string): Promise<void> {
  const provider = process.env.EMAIL_PROVIDER ?? "console";
  try {
    const sent = provider === "resend" ? await emailViaResend(to, subject, text) : (console.log(`[email → ${to}] ${subject}\n${text}`), { provider: "console" });
    await db.outboundMessage.create({ data: { channel: "EMAIL", to, subject, body: text, status: "SENT", ...sent } });
  } catch (e) {
    await db.outboundMessage.create({ data: { channel: "EMAIL", to, subject, body: text, status: "FAILED", provider, error: String(e).slice(0, 500) } });
    throw e;
  }
}
