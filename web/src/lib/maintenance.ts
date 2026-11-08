// Scheduled maintenance: listing expiry and clean-up of temporary data.
// Run by the worker every 10 minutes (one worker at a time, via CronRun), or by hand: `npm run maintenance`.
// Imported by the worker, so no Next.js-only imports here.
import { db } from "./db";
import { enqueue } from "./jobs";
import { deleteObject } from "./storage";

const DAY = 864e5;
const SITE = () => process.env.SITE_URL ?? "http://localhost:3000";
/** Work per run is capped, so one run never holds the database for long; the rest waits for the next run. */
const BATCH = 500;

export const MAINTENANCE_EVERY_MS = 10 * 60_000;

const fmtDate = (d: Date) => d.toLocaleDateString("en-PH", { month: "short", day: "numeric", timeZone: "Asia/Manila" });

type Poster = { name: string; phone: string | null; email: string | null; status: string };

async function notify(poster: Poster, sms: string, subject: string, text: string) {
  if (poster.status !== "ACTIVE") return;
  if (poster.phone) await enqueue("sms.send", { to: poster.phone, body: sms });
  if (poster.email) await enqueue("email.send", { to: poster.email, subject, text: `Hi ${poster.name},\n\n${text}` });
}

/** "Expires in 3 days" reminders, once per expiry period (renewing clears expiryReminderAt). */
async function sendExpiryReminders(now: Date) {
  const soon = await db.listing.findMany({
    where: { status: "ACTIVE", expiryReminderAt: null, expiresAt: { gt: now, lte: new Date(now.getTime() + 3 * DAY) } },
    select: { id: true, refCode: true, title: true, expiresAt: true, poster: { select: { name: true, phone: true, email: true, status: true } } },
    take: BATCH,
  });
  for (const l of soon) {
    // Mark first: if the notice fails to queue, we'd rather skip one reminder than send it every 10 minutes.
    await db.listing.update({ where: { id: l.id }, data: { expiryReminderAt: now } });
    const when = fmtDate(l.expiresAt!);
    await notify(
      l.poster,
      `PropertyNest: Your listing ${l.refCode} expires on ${when}. Renew it to stay in search: ${SITE()}/account`,
      `Your listing expires on ${when}`,
      `Your listing ${l.refCode} "${l.title}" expires on ${when} and will then be hidden from search.\n\nStill available? Renew it with one click: ${SITE()}/account\n\nAlready sold, rented or leased? Mark it as closed there so buyers stop calling.`,
    );
  }
  return soon.length;
}

/** Live listings past their expiry date leave search. The poster can renew them with one click. */
async function expireListings(now: Date) {
  const due = await db.listing.findMany({
    where: { status: "ACTIVE", expiresAt: { lte: now } },
    select: { id: true, refCode: true, title: true, poster: { select: { name: true, phone: true, email: true, status: true } } },
    take: BATCH,
  });
  if (!due.length) return 0;
  await db.listing.updateMany({ where: { id: { in: due.map((l) => l.id) }, status: "ACTIVE" }, data: { status: "EXPIRED" } });
  await db.auditLog.createMany({
    data: due.map((l) => ({ action: "listing.expire", entityType: "Listing", entityId: l.id })),
  });
  for (const l of due) {
    await notify(
      l.poster,
      `PropertyNest: Your listing ${l.refCode} has expired and is hidden from search. Renew it with one click: ${SITE()}/account`,
      "Your listing has expired",
      `Your listing ${l.refCode} "${l.title}" has expired and no longer appears in search.\n\nRenew it with one click: ${SITE()}/account`,
    );
  }
  return due.length;
}

/** Photos uploaded but never attached to a listing (abandoned forms) are deleted after a day. */
async function cleanUploads(now: Date) {
  const stale = await db.upload.findMany({ where: { createdAt: { lt: new Date(now.getTime() - DAY) } }, select: { id: true, storageKey: true }, take: BATCH });
  for (const u of stale) {
    await deleteObject(u.storageKey);
    await deleteObject(u.storageKey.replace(/\.webp$/, "-sm.webp"));
  }
  if (stale.length) await db.upload.deleteMany({ where: { id: { in: stale.map((u) => u.id) } } });
  return stale.length;
}

export async function runMaintenance(now = new Date()) {
  const ago = (days: number) => new Date(now.getTime() - days * DAY);
  const result = {
    remindersSent: await sendExpiryReminders(now),
    listingsExpired: await expireListings(now),
    uploadsDeleted: await cleanUploads(now),
    // Personal and security data is kept only as long as it's useful (Data Privacy Act: data minimisation).
    otpCodesDeleted: (await db.otpCode.deleteMany({ where: { createdAt: { lt: ago(1) } } })).count,
    sessionsDeleted: (await db.session.deleteMany({ where: { expiresAt: { lt: now } } })).count,
    linkTokensDeleted: (await db.authToken.deleteMany({ where: { OR: [{ expiresAt: { lt: ago(7) } }, { usedAt: { lt: ago(7) } }] } })).count,
    loginAttemptsDeleted: (await db.loginAttempt.deleteMany({ where: { createdAt: { lt: ago(7) } } })).count,
    rateEventsDeleted: (await db.rateEvent.deleteMany({ where: { createdAt: { lt: ago(1) } } })).count,
    jobsDeleted: (await db.job.deleteMany({ where: { OR: [{ status: "DONE", finishedAt: { lt: ago(14) } }, { status: "FAILED", finishedAt: { lt: ago(90) } }] } })).count,
    messagesDeleted: (await db.outboundMessage.deleteMany({ where: { createdAt: { lt: ago(180) } } })).count,
  };
  return result;
}

/**
 * Runs maintenance if it's due and no other worker has claimed this run. Returns the result, or null when skipped.
 * The claim is one conditional UPDATE, so two workers can't both win it.
 */
export async function runMaintenanceIfDue(now = new Date()) {
  await db.cronRun.upsert({ where: { name: "maintenance" }, create: { name: "maintenance", lastStartedAt: new Date(0) }, update: {} });
  const claimed = await db.cronRun.updateMany({
    where: { name: "maintenance", lastStartedAt: { lt: new Date(now.getTime() - MAINTENANCE_EVERY_MS + 5_000) } },
    data: { lastStartedAt: now },
  });
  if (claimed.count === 0) return null;
  const result = await runMaintenance(now);
  await db.cronRun.update({ where: { name: "maintenance" }, data: { lastFinishedAt: new Date(), lastResult: result } });
  return result;
}
