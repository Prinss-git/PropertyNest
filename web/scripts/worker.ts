/**
 * Background worker: sends SMS/email and runs other queued jobs.
 *   npm run worker
 * Run one per server in production (more for throughput; they don't step on each other).
 */
import { db } from "../src/lib/db";
import { runDueJobs } from "../src/lib/jobs";

const IDLE_MS = 2000;
let stopping = false;

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    console.log(`\n${sig} received, finishing current batch…`);
    stopping = true;
  });
}

async function main() {
  console.log(`Worker started (SMS: ${process.env.SMS_PROVIDER ?? "console"}, email: ${process.env.EMAIL_PROVIDER ?? "console"})`);
  while (!stopping) {
    let n = 0;
    try {
      n = await runDueJobs(20);
      if (n) console.log(`Processed ${n} job(s)`);
    } catch (e) {
      console.error("Worker loop error:", e);
    }
    if (!n) await new Promise((r) => setTimeout(r, IDLE_MS));
  }
  await db.$disconnect();
}

main();
