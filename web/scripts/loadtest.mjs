/**
 * Load test: many visitors at once on the pages people use most, then a pass/fail summary.
 *   npm run loadtest                                   (against http://localhost:3000)
 *   npm run loadtest -- https://staging.example.com    (a staging copy; never the live site at peak hours)
 *   npm run loadtest -- <url> --connections 50 --seconds 20
 *
 * It only reads pages (GET), so it creates no data. Run it against the real host before launch: a laptop
 * result only shows the code has no slow spots, not how the paid server will cope.
 */
import autocannon from "autocannon";

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? Number(args[i + 1]) : dflt;
};
const base = (args.find((a) => /^https?:\/\//.test(a)) ?? "http://localhost:3000").replace(/\/$/, "");
const connections = flag("connections", 25);
const seconds = flag("seconds", 15);

// Pass marks for a launch-sized site: most visitors get an answer in well under a second, none fail.
const LIMITS = { p97Ms: 1500, errorRate: 0.01 };

async function pickListing() {
  try {
    const html = await (await fetch(`${base}/listings?mode=rent`)).text();
    return html.match(/href="\/property\/(PN-[A-Z0-9-]+)"/)?.[1] ?? null;
  } catch {
    return null;
  }
}

function run(name, path) {
  return new Promise((resolve, reject) => {
    const inst = autocannon(
      { url: base + path, connections, duration: seconds, headers: { "user-agent": "PropertyNest load test", accept: "text/html" } },
      (err, r) => (err ? reject(err) : resolve({ name, path, r })),
    );
    autocannon.track(inst, { renderProgressBar: false, renderResultsTable: false, renderLatencyTable: false });
  });
}

const ref = await pickListing();
const scenarios = [
  ["Home page", "/"],
  ["Search results", "/listings?mode=rent&type=condo"],
  ["Search with a place", "/listings?mode=buy&q=Makati"],
  ...(ref ? [["A listing", `/property/${ref}`]] : []),
  ["Health check", "/api/health"],
];

console.log(`Load test: ${base} · ${connections} visitors at once · ${seconds}s per page\n`);
let failed = false;
const rows = [];
for (const [name, path] of scenarios) {
  const { r } = await run(name, path);
  const total = r.requests.total || 1;
  const bad = r.errors + r.timeouts + r.non2xx;
  const errorRate = bad / total;
  const ok = r.latency.p97_5 <= LIMITS.p97Ms && errorRate <= LIMITS.errorRate;
  if (!ok) failed = true;
  rows.push({
    page: name,
    "requests/s": Math.round(r.requests.average),
    "typical (ms)": Math.round(r.latency.p50),
    "slowest 2.5% (ms)": Math.round(r.latency.p97_5),
    errors: bad,
    result: ok ? "ok" : "SLOW/ERRORS",
  });
}
console.table(rows);
console.log(failed
  ? `\nSome pages missed the target (97.5% under ${LIMITS.p97Ms} ms, under ${LIMITS.errorRate * 100}% errors).`
  : `\nAll pages met the target: 97.5% of requests under ${LIMITS.p97Ms} ms with under ${LIMITS.errorRate * 100}% errors.`);
process.exit(failed ? 1 : 0);
