/**
 * Runs maintenance once, right now (the worker also runs it every 10 minutes):
 *   npm run maintenance
 * Expires listings past their date, sends "expires in 3 days" reminders, and deletes stale temporary data.
 */
import { db } from "../src/lib/db";
import { runMaintenance } from "../src/lib/maintenance";

runMaintenance()
  .then(async (result) => {
    await db.cronRun.upsert({
      where: { name: "maintenance" },
      create: { name: "maintenance", lastStartedAt: new Date(), lastFinishedAt: new Date(), lastResult: result },
      update: { lastFinishedAt: new Date(), lastResult: result },
    });
    console.log("Maintenance done:", result);
  })
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
