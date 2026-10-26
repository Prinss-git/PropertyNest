// Postgres-backed job queue. Web requests enqueue; `npm run worker` runs the handlers.
// Imported by the worker too, so no Next.js-only imports here.
import { Prisma, type Job } from "@prisma/client";
import { db } from "./db";
import { sendEmail, sendSms } from "./messaging";

type Tx = Prisma.TransactionClient | typeof db;

export type JobPayloads = {
  "sms.send": { to: string; body: string };
  "email.send": { to: string; subject: string; text: string };
  "inquiry.notify": { inquiryId: string };
  "listing.reviewed": { listingId: string };
};
export type JobType = keyof JobPayloads;

/** Pass the transaction client when enqueueing alongside other writes, so the job only exists if they commit. */
export async function enqueue<T extends JobType>(type: T, payload: JobPayloads[T], opts: { tx?: Tx; runAt?: Date } = {}) {
  await (opts.tx ?? db).job.create({ data: { type, payload: payload as Prisma.InputJsonValue, runAt: opts.runAt } });
}

const SITE = () => process.env.SITE_URL ?? "http://localhost:3000";

const handlers: { [T in JobType]: (p: JobPayloads[T]) => Promise<void> } = {
  "sms.send": ({ to, body }) => sendSms(to, body),
  "email.send": ({ to, subject, text }) => sendEmail(to, subject, text),

  // Fans out to separate SMS + email jobs, so a failed email never re-sends the SMS.
  "inquiry.notify": async ({ inquiryId }) => {
    const inq = await db.inquiry.findUnique({
      where: { id: inquiryId },
      include: {
        listing: {
          select: {
            refCode: true, title: true,
            agent: { select: { name: true, phone: true, email: true } },
            poster: { select: { name: true, phone: true, email: true } },
          },
        },
      },
    });
    if (!inq) return;
    const to = inq.listing.agent ?? inq.listing.poster;
    const url = `${SITE()}/account/leads`;
    const sms = `PropertyNest: New inquiry from ${inq.name} for ${inq.listing.refCode}. Reply fast, buyers contact several agents. ${url}`;
    const text = [
      `Hi ${to.name},`,
      "",
      `${inq.name} sent an inquiry about your listing ${inq.listing.refCode}: "${inq.listing.title}".`,
      "",
      `Message: ${inq.message}`,
      "",
      `Email: ${inq.email}`,
      inq.phone ? `Mobile: ${inq.phone}` : "",
      inq.company ? `Company: ${inq.company}` : "",
      inq.preferredDate ? `Preferred move-in: ${inq.preferredDate.toISOString().slice(0, 10)}` : "",
      "",
      `See all your leads: ${url}`,
    ].filter((l) => l !== "").join("\n");
    await db.$transaction(async (tx) => {
      if (to.phone) await enqueue("sms.send", { to: to.phone, body: sms }, { tx });
      if (to.email) await enqueue("email.send", { to: to.email, subject: `New inquiry: ${inq.listing.title}`, text }, { tx });
    });
  },

  "listing.reviewed": async ({ listingId }) => {
    const l = await db.listing.findUnique({ where: { id: listingId }, select: { refCode: true, status: true, rejectionReason: true, poster: { select: { phone: true } } } });
    if (!l?.poster.phone) return;
    const body =
      l.status === "ACTIVE" ? `PropertyNest: Your listing ${l.refCode} is now live. ${SITE()}/property/${l.refCode}`
      : l.status === "ARCHIVED" ? `PropertyNest: Your listing ${l.refCode} was removed: ${l.rejectionReason ?? "it broke our listing rules"}.`
      : `PropertyNest: Your listing ${l.refCode} needs changes before it can go live: ${l.rejectionReason ?? "see your account"}. ${SITE()}/account`;
    await enqueue("sms.send", { to: l.poster.phone, body });
  },
};

/**
 * Claims up to `limit` due jobs and runs them. Safe with many workers: rows are locked with SKIP LOCKED,
 * and jobs stuck RUNNING for 5+ minutes (a crashed worker) are picked up again.
 */
export async function runDueJobs(limit = 10): Promise<number> {
  const jobs = await db.$queryRaw<Job[]>`
    UPDATE "Job" SET status = 'RUNNING', "lockedAt" = now(), attempts = attempts + 1
    WHERE id IN (
      SELECT id FROM "Job"
      WHERE (status = 'QUEUED' AND "runAt" <= now())
         OR (status = 'RUNNING' AND "lockedAt" < now() - interval '5 minutes')
      ORDER BY "runAt"
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *`;

  for (const job of jobs) {
    try {
      const handler = handlers[job.type as JobType] as ((p: unknown) => Promise<void>) | undefined;
      if (!handler) throw new Error(`No handler for job type "${job.type}"`);
      await handler(job.payload);
      await db.job.update({ where: { id: job.id }, data: { status: "DONE", finishedAt: new Date(), lastError: null } });
    } catch (e) {
      const giveUp = job.attempts >= job.maxAttempts;
      // Exponential backoff: 30s, 1m, 2m, 4m, ...
      const delay = 30_000 * 2 ** (job.attempts - 1);
      await db.job.update({
        where: { id: job.id },
        data: {
          status: giveUp ? "FAILED" : "QUEUED",
          runAt: giveUp ? undefined : new Date(Date.now() + delay),
          lastError: String(e).slice(0, 1000),
          finishedAt: giveUp ? new Date() : null,
        },
      });
      console.error(`[job ${job.type} ${job.id}] attempt ${job.attempts} failed${giveUp ? " (giving up)" : ""}:`, e);
    }
  }
  return jobs.length;
}
