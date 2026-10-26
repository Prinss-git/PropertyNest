/**
 * Background worker: sends SMS/email and runs other queued jobs.
 *   npm run worker
 * Runs two lanes: "fast" (SMS, email, alerts) and "slow" (map lookups that take ~20 s each),
 * so an inquiry alert never waits behind a map lookup. Run one per server; more for throughput.
 */
import { db } from "../src/lib/db";
import { runDueJobs } from "../src/lib/jobs";

const IDLE_MS = 2000;
let stopping = false;

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    console.log(`\n${sig} received, finishing current jobs…`);
    stopping = true;
  });
}

async function lane(name: "fast" | "slow", batch: number) {
  while (!stopping) {
    let n = 0;
    try {
      n = await runDueJobs(batch, name);
      if (n) console.log(`[${name}] processed ${n} job(s)`);
    } catch (e) {
      console.error(`[${name}] loop error:`, e);
    }
    if (!n) await new Promise((r) => setTimeout(r, IDLE_MS));
  }
}

async function main() {
  console.log(`Worker started (SMS: ${process.env.SMS_PROVIDER ?? "console"}, email: ${process.env.EMAIL_PROVIDER ?? "console"})`);
  // The slow lane takes one job at a time: the places service allows ~1 request per second in total.
  await Promise.all([lane("fast", 20), lane("slow", 1)]);
  await db.$disconnect();
}

main();
