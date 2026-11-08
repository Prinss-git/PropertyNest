// Drives a real Chrome through the main flows: log in page, sign up, post a listing with photos and a map pin,
// moderate it, inquire, and the phone layout. Screenshots go to tests/output/ for a visual check.
// Needs the app + worker running (see api.test.mjs) and Google Chrome installed (or CHROME_PATH).
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import puppeteer from "puppeteer-core";

const WEB_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const OUT = join(WEB_DIR, "tests", "output");
const IMG = join(WEB_DIR, "public", "img");
mkdirSync(OUT, { recursive: true });
const db = new PrismaClient(); // reads the confirmation email from the dev outbox

const CHROME = process.env.CHROME_PATH ?? [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
].find(existsSync);
if (!CHROME) throw new Error("Chrome not found. Set CHROME_PATH to its executable.");
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, defaultViewport: { width: 1366, height: 900 } });
const errors = [];
const shot = (page, name, full = true) => page.screenshot({ path: `${OUT}/ui_${name}.png`, fullPage: full });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Each user gets an isolated browser context (own cookies), like separate people on separate devices.
async function newPage() {
  const ctx = await browser.createBrowserContext();
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  p.on("console", (m) => m.type() === "error" && !m.text().includes("404") && errors.push(`console: ${m.text()}`));
  return p;
}

async function submitForm(page) {
  const btn = await page.$('form button[type="submit"], form button:not([type="button"])');
  await btn.evaluate((b) => b.scrollIntoView({ block: "center" }));
  await btn.click();
}

// 0. Log-in page design, Google (not configured), phone OTP page
const visitor0 = await newPage();
await visitor0.goto(`${BASE}/login`, { waitUntil: "networkidle0" });
await shot(visitor0, "login", false);
await visitor0.click('a[href^="/api/auth/google"]');
await visitor0.waitForFunction(() => location.search.includes("google_unavailable"));
await shot(visitor0, "login_google_unavailable", false);
await visitor0.click('a[href^="/login/phone"]');
await visitor0.waitForSelector("#phone");
await shot(visitor0, "login_phone", false);

// 1. Owner signs up with email + password and posts a listing through the form
const owner = await newPage();
await owner.goto(`${BASE}/login`, { waitUntil: "networkidle0" });
await owner.click('a[href^="/signup"]');
await owner.waitForSelector("#name");
await owner.type("#name", "Liza Navarro");
await owner.type("#email", `liza.${Date.now()}@example.com`);
await owner.type("#password", "Ortigas-office-88");
await owner.evaluate(() => document.querySelector('input[value="OWNER"]').click());
await shot(owner, "signup", false);
await submitForm(owner);
await owner.waitForFunction(() => location.pathname === "/post", { timeout: 15000 });
await owner.waitForSelector(".avatar-btn");
// New email accounts must confirm their email before posting: the page says so instead of showing the form.
await owner.waitForFunction(() => document.body.textContent.includes("Confirm your email to post"), { timeout: 10000 });
await shot(owner, "post_needs_confirmation", false);
// Open the link from the confirmation email (the worker "sends" it to the outbox in development).
const ownerEmail = await owner.$eval(".empty strong", (e) => e.textContent);
let verifyLink = null;
for (let i = 0; i < 15 && !verifyLink; i++) {
  const msg = await db.outboundMessage.findFirst({ where: { channel: "EMAIL", to: ownerEmail, subject: { contains: "Confirm" } }, orderBy: { createdAt: "desc" } });
  verifyLink = msg?.body.match(/https?:\/\/\S+\/verify-email\?token=[A-Za-z0-9_-]+/)?.[0] ?? null;
  if (!verifyLink) await sleep(1000);
}
if (!verifyLink) throw new Error("Confirmation email never arrived (is the worker running?)");
await owner.goto(verifyLink.replace(/^https?:\/\/[^/]+/, BASE), { waitUntil: "networkidle0" });

await owner.goto(`${BASE}/post`, { waitUntil: "networkidle0" });
await owner.evaluate(() => [...document.querySelectorAll(".mode-picker label")].find((l) => l.textContent.includes("Lease")).click());
await owner.select("#p-type", "office");
await owner.type("#p-title", "Fitted 120 sqm office in Ortigas Center");
await owner.select("#p-city", await owner.$eval("#p-city", (s) => [...s.options].find((o) => o.text.startsWith("Pasig")).value));
await owner.type("#p-area", "Ortigas Center");
await owner.type("#p-price", "180000");
await owner.type("#p-floor", "120");
await owner.evaluate(() => [...document.querySelectorAll(".amen-checks label")].filter((l) => /Parking|Central Aircon|Backup Generator/.test(l.textContent)).forEach((l) => l.querySelector("input").click()));
await owner.type("#p-desc", "Fully fitted office on a high floor with 14 workstations, two meeting rooms, a pantry and a server room. Walking distance to Megamall and the MRT.");
// Drop the map pin (the map re-centred on Pasig when the city was chosen), and show the exact spot.
await owner.waitForSelector(".picker-map .leaflet-tile-loaded", { timeout: 20000 });
await owner.$eval(".picker-map", (m) => m.scrollIntoView({ block: "center" }));
await sleep(800);
const pbox = await (await owner.$(".picker-map")).boundingBox();
await owner.mouse.click(pbox.x + pbox.width * 0.5, pbox.y + pbox.height * 0.5);
await owner.waitForSelector(".picker-map .leaflet-marker-icon");
await owner.evaluate(() => [...document.querySelectorAll(".picker label.check input")][0].click());
const input = await owner.$('.uploader input[type="file"]');
await input.uploadFile(`${IMG}/1497366216548-37526070297c.jpg`, `${IMG}/1497366811353-6870744d04b2.jpg`, `${IMG}/1504384308090-c894fdcc538d.jpg`);
await owner.waitForFunction(() => document.querySelectorAll(".photo-tile").length === 3, { timeout: 30000 });
await shot(owner, "post_form");
const btn = await owner.$('form.form-card button[type="submit"]');
await btn.evaluate((b) => b.scrollIntoView({ block: "center" }));
await btn.click();
try {
  await owner.waitForFunction(() => location.pathname === "/account" && location.search.includes("saved="), { timeout: 20000 });
} catch (e) {
  await shot(owner, "post_failed");
  console.log("URL:", owner.url(), "ERRORS:", await owner.evaluate(() => [...document.querySelectorAll(".form-error")].map((x) => x.textContent)));
  throw e;
}
await owner.waitForSelector(".my-listing");
await shot(owner, "account_after_post");
const ref = await owner.evaluate(() => new URLSearchParams(location.search).get("saved"));
console.log("posted", ref);

// 2. Moderator reviews it
const mod = await newPage();
await mod.goto(`${BASE}/login?next=/admin`, { waitUntil: "networkidle0" });
await mod.type("#email", "moderator@example.com");
await mod.type("#password", "Nest-demo-2026");
await submitForm(mod);
await mod.waitForFunction(() => location.pathname === "/admin", { timeout: 15000 });
await mod.waitForSelector(".mod-item");
await shot(mod, "admin_queue");
await mod.evaluate((ref) => {
  const item = [...document.querySelectorAll(".mod-item")].find((el) => el.textContent.includes(ref));
  [...item.querySelectorAll("button")].find((b) => b.textContent === "Approve").click();
}, ref);
await mod.waitForFunction((ref) => ![...document.querySelectorAll(".mod-item")].some((el) => el.textContent.includes(ref)), { timeout: 15000 }, ref);

// 3. The listing is live; a visitor sends an inquiry
const visitor = await newPage();
await visitor.goto(`${BASE}/property/${ref}`, { waitUntil: "networkidle0" });
await visitor.type('input[name="name"]', "Ben Sy");
await visitor.type('input[name="email"]', "ben@example.com");
await visitor.click(".side-card button.btn-primary");
await visitor.waitForSelector(".toast");
await shot(visitor, "property_live");
await sleep(5000); // worker sends the alerts

await owner.goto(`${BASE}/account/leads`, { waitUntil: "networkidle0" });
await shot(owner, "leads");
await mod.goto(`${BASE}/admin?tab=outbox`, { waitUntil: "networkidle0" });
await shot(mod, "outbox");

// 4. Header menu + phone layout
await owner.goto(`${BASE}/`, { waitUntil: "networkidle0" });
await owner.click(".avatar-btn");
await shot(owner, "account_menu", false);
await owner.setViewport({ width: 390, height: 844, isMobile: true });
await owner.goto(`${BASE}/post`, { waitUntil: "networkidle0" });
await shot(owner, "post_mobile", false);
const overflow = await owner.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
if (overflow > 0) errors.push(`phone layout scrolls sideways by ${overflow}px on /post`);

// 5. Account settings (phone layout) and admin user management
await owner.goto(`${BASE}/account/settings`, { waitUntil: "networkidle0" });
await shot(owner, "settings_mobile");
const settingsOverflow = await owner.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
if (settingsOverflow > 0) errors.push(`phone layout scrolls sideways by ${settingsOverflow}px on /account/settings`);
await owner.setViewport({ width: 1366, height: 900 });
await owner.goto(`${BASE}/account/settings`, { waitUntil: "networkidle0" });
await shot(owner, "settings");
await mod.goto(`${BASE}/admin?tab=users`, { waitUntil: "networkidle0" });
await shot(mod, "admin_users");
const firstUser = await mod.$eval(".data-table a.link-strong", (a) => a.getAttribute("href"));
await mod.goto(`${BASE}${firstUser}`, { waitUntil: "networkidle0" });
await shot(mod, "admin_user_detail");
await mod.goto(`${BASE}/admin?tab=activity`, { waitUntil: "networkidle0" });
await shot(mod, "admin_activity", false);

await browser.close();
await db.$disconnect();
console.log(errors.length ? "✗ Problems:\n  " + errors.join("\n  ") : `✓ UI flow passed (screenshots in ${OUT})`);
process.exit(errors.length ? 1 : 0);
