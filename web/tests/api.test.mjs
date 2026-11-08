// End-to-end API tests. Run against a running app + worker on a freshly seeded database:
//   npm run db:seed && npm run build && npm start      (terminal 1)
//   npm run worker                                     (terminal 2)
//   npm run test:api                                   (terminal 3)
// TEST_BASE_URL overrides the address (default http://localhost:3000).
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { PrismaClient } from "@prisma/client";

const WEB_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const IMG_DIR = join(WEB_DIR, "public", "img");
// A few checks set up states directly (e.g. a listing whose expiry date has passed) or read counters.
const db = new PrismaClient();
const runMaintenance = () =>
  execFileSync(process.execPath, ["--env-file-if-exists=.env", "--import", "tsx", "scripts/maintenance.ts"], { cwd: WEB_DIR, stdio: "pipe" });
let pass = 0, fail = 0;
const ok = (cond, label, extra = "") => {
  if (cond) { pass++; console.log("  ✓", label); } else { fail++; console.log("  ✗", label, extra); }
};

class Client {
  constructor(ip) { this.cookie = ""; this.ip = ip; }
  async req(path, opts = {}) {
    const headers = { "X-Forwarded-For": this.ip, ...(opts.headers || {}) };
    if (this.cookie) headers.Cookie = this.cookie;
    let body = opts.body;
    if (body && !(body instanceof FormData)) { headers["Content-Type"] = "application/json"; body = JSON.stringify(body); }
    const res = await fetch(BASE + path, { method: opts.method || (body ? "POST" : "GET"), headers, body, redirect: "manual" });
    const set = res.headers.get("set-cookie");
    if (set) this.cookie = set.split(";")[0];
    const text = await res.text();
    let json = null; try { json = JSON.parse(text); } catch {}
    return { status: res.status, json, text, location: res.headers.get("location") };
  }
  async login(phone, profile) {
    const r1 = await this.req("/api/auth/otp", { body: { phone } });
    if (r1.status !== 200) return r1;
    let r2 = await this.req("/api/auth/verify", { body: { phone, code: r1.json.devCode } });
    if (r2.json?.needsProfile && profile) r2 = await this.req("/api/auth/verify", { body: { phone, code: r1.json.devCode, ...profile } });
    return r2;
  }
}

const rand = () => String(Math.floor(Math.random() * 9e6) + 1e6);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function uploadPhotos(c, files) {
  const ids = [];
  for (const f of files) {
    const fd = new FormData();
    fd.append("file", new Blob([readFileSync(`${IMG_DIR}/${f}`)], { type: "image/jpeg" }), f);
    const r = await c.req("/api/uploads", { body: fd });
    if (r.status === 201) ids.push(r.json.id); else console.log("    upload failed", r.status, r.json);
  }
  return ids;
}

const listingBody = (photoIds, over = {}) => ({
  mode: "rent", type: "condo",
  title: "Bright 1BR condo near Ayala Triangle",
  description: "Fully furnished one-bedroom unit with a city view, walking distance to Greenbelt and Ayala Triangle Gardens. Building has a pool and gym.",
  price: 45000, cityId: CITY, areaName: "Salcedo Village", address: "",
  bedrooms: 1, bathrooms: 1, floorArea: 42, lotArea: null, parking: 1, furnishing: "FULLY_FURNISHED",
  amenities: ["Swimming Pool", "Gym"],
  terms: { depositMonths: 2, advanceMonths: 1, minStayMonths: 12, petFriendly: false },
  lat: 14.5603, lng: 121.0237, showExactLocation: false,
  photoIds, ...over,
});

let CITY;
const PHOTOS = ["1502672260266-1c1ef2d93688.jpg", "1522708323590-d24dbb6b0267.jpg", "1560448204-e02f11c3d0e2.jpg", "1493809842364-78817add7ffb.jpg", "1586023492125-27b2c045efd7.jpg", "1600210492486-724fe5c67fb0.jpg"];

console.log("\n1. Sign-up with SMS OTP");
const owner = new Client("198.51.100." + rand().slice(0, 2));
const phone = "0917" + rand();
let r = await owner.req("/api/auth/otp", { body: { phone: "12345" } });
ok(r.status === 400, "rejects a non-PH number", r.status);
r = await owner.req("/api/auth/otp", { body: { phone } });
ok(r.status === 200 && /^\d{6}$/.test(r.json?.devCode), "sends a 6-digit code", JSON.stringify(r.json));
const code = r.json.devCode;
r = await owner.req("/api/auth/otp", { body: { phone } });
ok(r.status === 429, "blocks a second code within 60s", r.status);
r = await owner.req("/api/auth/verify", { body: { phone, code: code === "000000" ? "111111" : "000000" } });
ok(r.status === 400 && /4 attempts left/.test(r.json?.error), "wrong code counts attempts", JSON.stringify(r.json));
r = await owner.req("/api/auth/verify", { body: { phone, code } });
ok(r.json?.needsProfile === true, "new number asks for a profile");
r = await owner.req("/api/auth/verify", { body: { phone, code, name: "Rosa Mendoza", role: "OWNER", email: "rosa@example.com" } });
ok(r.status === 200 && owner.cookie.startsWith("pn_session="), "creates account and sets session cookie", JSON.stringify(r.json));
r = await owner.req("/api/auth/me");
ok(r.json?.user?.name === "Rosa Mendoza" && r.json.user.role === "OWNER", "/api/auth/me knows the user");
r = await owner.req("/api/auth/verify", { body: { phone, code } });
ok(r.status === 400, "a used code can't be reused", r.status);

console.log("\n2. Photo upload");
const bad = new FormData(); bad.append("file", new Blob(["not an image"], { type: "image/jpeg" }), "x.jpg");
r = await owner.req("/api/uploads", { body: bad });
ok(r.status === 415, "rejects a non-image file", r.status);
r = await new Client("10.0.0.1").req("/api/uploads", { body: bad });
ok(r.status === 401, "signed-out upload is refused", r.status);
const ids = await uploadPhotos(owner, PHOTOS.slice(0, 3));
ok(ids.length === 3, "uploads 3 photos");
const lst = await owner.req("/api/listings?mode=rent&q=makati");
CITY = (await (await fetch(BASE + "/post", { headers: { Cookie: owner.cookie } })).text()).match(/<option value="([^"]+)"[^>]*>Makati(?:<!-- -->)?, /)?.[1];
ok(!!CITY, "post form lists cities");

console.log("\n3. Post a listing → first listing goes to review");
r = await owner.req("/api/my/listings", { body: listingBody(ids.slice(0, 2)) });
ok(r.status === 400 && /at least 3 photos/.test(r.json?.error), "needs at least 3 photos", JSON.stringify(r.json));
r = await owner.req("/api/my/listings", { body: listingBody(ids, { mode: "rent", type: "office" }) });
ok(r.status === 400, "office isn't allowed under Rent", r.status);
r = await owner.req("/api/my/listings", { body: listingBody(ids) });
ok(r.status === 201 && r.json.status === "PENDING" && r.json.flags.some((f) => f.code === "new_poster"), "created, held for review (first listing)", JSON.stringify(r.json));
const REF = r.json?.ref;
r = await owner.req(`/api/listings/${REF}`);
ok(r.status === 404, "pending listing isn't public yet", r.status);

console.log("\n4. Moderation");
r = await owner.req(`/api/admin/listings/${REF}`, { body: { decision: "approve" } });
ok(r.status === 403, "owner can't approve their own listing", r.status);
const mod = new Client("203.0.113.50");
r = await mod.login("+639170000001");
ok(r.status === 200, "moderator signs in", JSON.stringify(r.json));
const adminHtml = await mod.req("/admin");
ok(!!REF && adminHtml.status === 200 && adminHtml.text.includes(REF), "listing appears in the review queue");
r = await owner.req("/admin");
ok(r.status === 307 || r.status === 303 || r.status === 302, "owner is redirected away from /admin", r.status);
r = await mod.req(`/api/admin/listings/${REF}`, { body: { decision: "approve" } });
ok(r.status === 200, "moderator approves");
r = await owner.req(`/api/listings/${REF}`);
ok(r.status === 200 && r.json.status === "active", "listing is now public");
const page = await fetch(`${BASE}/property/${REF}`);
ok(page.status === 200, "property page renders", page.status);

console.log("\n5. Edits, scam wording, duplicate photos");
const ids2 = await uploadPhotos(owner, PHOTOS.slice(3, 6));
r = await owner.req(`/api/my/listings/${REF}`, { method: "PUT", body: listingBody(ids2, { price: 47000 }) });
ok(r.status === 200 && r.json.status === "ACTIVE", "clean edit of an approved listing stays live", JSON.stringify(r.json));
r = await owner.req("/api/my/listings", { body: listingBody(await uploadPhotos(owner, PHOTOS.slice(0, 3)), {
  title: "Cheap studio near BGC, 100% legit", description: "Send reservation fee via GCash before viewing to secure the unit. Text me at 0917 555 1234 for details right away.", price: 2500 }) });
const codes = (r.json?.flags || []).map((f) => f.code);
ok(r.status === 201 && r.json.status === "PENDING" && ["price_low", "scam_wording", "contact_in_text"].every((c) => codes.includes(c)), "scam-like listing is held with flags", codes.join(","));
const SCAM_REF = r.json?.ref;
const other = new Client("198.51.100.77");
await other.login("0917" + rand(), { name: "Copy Cat", role: "OWNER" });
const sameFiles = await uploadPhotos(other, PHOTOS.slice(0, 3));
r = await other.req("/api/my/listings", { body: listingBody(sameFiles) });
ok((r.json?.flags || []).some((f) => f.code === "duplicate_photos"), "reused photos from another poster are flagged", JSON.stringify(r.json?.flags));

console.log("\n6. Owner limit (3 active)");
r = await owner.req("/api/my/listings", { body: listingBody(await uploadPhotos(owner, PHOTOS.slice(0, 3)), { title: "Second 1BR condo near Greenbelt" }) });
ok(r.status === 201, "3rd listing allowed", r.status);
const REF2 = r.json?.ref;
r = await owner.req("/api/my/listings", { body: listingBody(await uploadPhotos(owner, PHOTOS.slice(0, 3)), { title: "Fourth listing should be blocked" }) });
ok(r.status === 403 && /3 active listings/.test(r.json?.error), "4th listing blocked", JSON.stringify(r.json));

console.log("\n6b. Listing expiry (scheduled maintenance)");
await db.listing.update({ where: { refCode: REF2 }, data: { status: "ACTIVE", expiresAt: new Date(Date.now() - 60_000) } });
await db.listing.update({ where: { refCode: REF }, data: { expiresAt: new Date(Date.now() + 2 * 864e5), expiryReminderAt: null } });
runMaintenance();
r = await owner.req(`/api/listings/${REF2}`);
ok(r.json?.status === "expired", "listing past its date is marked expired", r.json?.status);
r = await owner.req(`/api/listings?ids=${REF2}`);
ok(r.json?.total === 0, "expired listing leaves search");
let row = await db.listing.findUnique({ where: { refCode: REF }, select: { status: true, expiryReminderAt: true } });
ok(row.status === "ACTIVE" && !!row.expiryReminderAt, "listing expiring in 2 days gets a reminder and stays live");
runMaintenance();
await wait(5000);
let outboxText = (await mod.req("/admin?tab=outbox")).text;
// Count in the database: page HTML repeats every text (once rendered, once in the data Next.js hydrates from).
const reminderCount = await db.outboundMessage.count({ where: { channel: "SMS", body: { contains: `${REF} expires on` } } });
ok(reminderCount === 1, "reminder is sent once, not on every run", `sent ${reminderCount} times`);
ok(outboxText.includes(`${REF2} has expired`), "poster is told the listing expired");
r = await owner.req(`/api/my/listings/${REF2}`, { body: { action: "renew" } });
row = await db.listing.findUnique({ where: { refCode: REF2 }, select: { status: true, expiresAt: true, expiryReminderAt: true } });
ok(r.status === 200 && row.status === "ACTIVE" && row.expiresAt > new Date() && row.expiryReminderAt === null, "renewing brings it back with a fresh expiry date");

console.log("\n7. Moderator rejects → poster SMS");
r = await mod.req(`/api/admin/listings/${SCAM_REF}`, { body: { decision: "reject", reason: "Remove the payment request and phone number." } });
ok(r.status === 200, "moderator asks for changes");

console.log("\n8. Inquiry → agent alerts via worker");
const visitor = new Client("192.0.2.33");
r = await visitor.req("/api/inquiries", { body: { listingRef: REF, name: "Carlo Reyes", email: "carlo@example.com", phone: "0918 222 3333", message: "Hi, is the unit available from December? I'd like to view it this weekend." } });
ok(r.status === 201, "inquiry accepted", JSON.stringify(r.json));
await wait(6000); // worker polls every 2s; inquiry.notify fans out to sms + email jobs
const outbox = await mod.req("/admin?tab=outbox");
ok(outbox.text.includes("New inquiry from Carlo Reyes"), "owner got an SMS about the inquiry");
ok(outbox.text.includes("New inquiry: Bright 1BR condo"), "owner got an email about the inquiry");
ok(outbox.text.includes(`Your listing ${REF} is now live`), "owner got the 'now live' SMS");
ok(outbox.text.includes("needs changes before it can go live"), "poster got the 'needs changes' SMS");
const leads = await owner.req("/account/leads");
ok(leads.text.includes("Carlo Reyes"), "inquiry shows in the owner's leads inbox");
const jobs = await mod.req("/admin?tab=jobs");
const failed = jobs.text.match(/<strong>(\d+)<\/strong><span>Failed/)?.[1];
ok(failed === "0", "no failed jobs", failed);

console.log("\n9. Favorites sync, reports, sign-out");
r = await owner.req("/api/favorites", { body: { add: ["PN-10001", "PN-10002", "NOPE"] } });
ok(r.status === 200 && r.json.refs.length === 2, "favorites saved to account (unknown refs ignored)", JSON.stringify(r.json));
r = await visitor.req("/api/reports", { body: { listingRef: REF, reason: "SCAM" } });
ok(r.status === 401, "reports need sign-in", r.status);
r = await other.req("/api/reports", { body: { listingRef: REF, reason: "WRONG_PRICE", details: "Price on the photo differs" } });
ok(r.status === 201, "signed-in user can report", r.status);
r = await owner.req(`/api/my/listings/${REF}`, { body: { action: "close", reason: "RENTED" } });
ok(r.status === 200, "owner marks the listing as rented");
r = await visitor.req("/api/inquiries", { body: { listingRef: REF, name: "Late Visitor", email: "late@example.com", message: "Is this still available for viewing?" } });
ok(r.status === 404, "closed listing stops taking inquiries", r.status);
r = await owner.req("/api/auth/logout", { body: {} });
r = await owner.req("/api/auth/me");
ok(r.json?.user === null, "signed out");

console.log("\n10. Email + password accounts");
const em = `tess.${rand()}@example.com`;
const ec = new Client("198.51.100.201");
r = await ec.req("/api/auth/signup", { body: { name: "Tess Aquino", email: em, password: "12345678", role: "OWNER" } });
ok(r.status === 400 && /letters/.test(r.json?.error), "rejects an all-number password", JSON.stringify(r.json));
r = await ec.req("/api/auth/signup", { body: { name: "Tess Aquino", email: em.toUpperCase(), password: "Manila-condo-77", role: "OWNER" } });
ok(r.status === 201 && ec.cookie.startsWith("pn_session="), "signs up and is signed in", JSON.stringify(r.json));
r = await ec.req("/api/auth/me");
ok(r.json?.user?.role === "OWNER", "new email account is an owner");
r = await new Client("198.51.100.202").req("/api/auth/signup", { body: { name: "Someone Else", email: em, password: "Another-pass-99", role: "SEEKER" } });
ok(r.status === 409, "same email can't sign up twice (case-insensitive)", r.status);
const lc = new Client("198.51.100.203");
r = await lc.req("/api/auth/login", { body: { email: em, password: "wrong-password-1" } });
ok(r.status === 401 && r.json.error === "Email or password is incorrect.", "wrong password: generic error", JSON.stringify(r.json));
r = await lc.req("/api/auth/login", { body: { email: "nobody-" + rand() + "@example.com", password: "whatever-123" } });
ok(r.status === 401 && r.json.error === "Email or password is incorrect.", "unknown email: same generic error");
r = await lc.req("/api/auth/login", { body: { email: em, password: "Manila-condo-77" } });
ok(r.status === 200 && lc.cookie.startsWith("pn_session="), "logs in with the right password");
r = await new Client("198.51.100.204").req("/api/auth/login", { body: { email: "owner@example.com", password: "Nest-demo-2026" } });
ok(r.status === 200, "demo owner can log in by email");

const brute = new Client("198.51.100.205");
for (let i = 0; i < 5; i++) await brute.req("/api/auth/login", { body: { email: em, password: "guess-" + i + "-abc" } });
r = await brute.req("/api/auth/login", { body: { email: em, password: "Manila-condo-77" } });
ok(r.status === 429, "6th try after 5 failures is blocked, even with the right password", r.status);

r = await new Client("198.51.100.206").req("/api/auth/forgot", { body: { email: "nobody-" + rand() + "@example.com" } });
ok(r.status === 200, "forgot-password doesn't reveal unknown emails");
r = await new Client("198.51.100.207").req("/api/auth/forgot", { body: { email: em } });
ok(r.status === 200, "forgot-password accepted");
await wait(5000);
const box = (await mod.req("/admin?tab=outbox")).text;
const resetToken = box.match(/reset-password\?token=([A-Za-z0-9_-]+)/)?.[1];
const verifyToken = box.match(/verify-email\?token=([A-Za-z0-9_-]+)/)?.[1];
ok(!!resetToken, "reset email was sent with a link");
ok(!!verifyToken, "verification email was sent with a link");
const rc = new Client("198.51.100.208");
r = await rc.req("/api/auth/reset", { body: { token: resetToken, password: "123" } });
ok(r.status === 400, "weak new password is rejected", r.status);
r = await rc.req("/api/auth/reset", { body: { token: resetToken, password: "Brand-new-pass-5" } });
ok(r.status === 200, "…and the link still works afterwards", JSON.stringify(r.json));
ok(r.status === 200 && rc.cookie.startsWith("pn_session="), "reset sets new password and signs in", JSON.stringify(r.json));
r = await rc.req("/api/auth/reset", { body: { token: resetToken, password: "Again-new-pass-6" } });
ok(r.status === 400, "reset link works only once", r.status);
r = await ec.req("/api/auth/me");
ok(r.json?.user === null, "reset signed out the other device");
r = await new Client("198.51.100.209").req("/api/auth/login", { body: { email: em, password: "Brand-new-pass-5" } });
ok(r.status === 200, "new password works right away (reset clears the lockout)", r.status);
const vpage = await fetch(`${BASE}/verify-email?token=${verifyToken}`);
ok((await vpage.text()).includes("Email confirmed"), "verification link confirms the email");

r = await new Client("198.51.100.210").req("/api/auth/google?next=/post");
ok(r.status >= 300 && r.status < 400 && /error=google_unavailable/.test(r.location || ""), "Google button explains it isn't configured yet", r.location);

console.log("\n11. Posting needs a confirmed email or phone");
const nico = new Client("198.51.100.220");
const nicoEmail = `nico.${rand()}@example.com`;
r = await nico.req("/api/auth/signup", { body: { name: "Nico Ramos", email: nicoEmail, password: "Pasig-loft-4421", role: "OWNER" } });
ok(r.status === 201, "email account created");
const nicoPhotos = await uploadPhotos(nico, PHOTOS.slice(0, 3));
r = await nico.req("/api/my/listings", { body: listingBody(nicoPhotos, { title: "Loft near Kapitolyo, Pasig" }) });
ok(r.status === 403 && /Confirm your email/.test(r.json?.error), "unconfirmed account can't post", JSON.stringify(r.json));
r = await nico.req("/post");
ok(r.text.includes("Confirm your email to post"), "post page explains what to do instead of showing the form");
r = await nico.req("/api/account/resend-verification", { body: {} });
ok(r.status === 200 && r.json.sentTo === nicoEmail, "confirmation link can be re-sent", JSON.stringify(r.json));
await wait(4000);
const nicoToken = (await mod.req("/admin?tab=outbox")).text.match(/verify-email\?token=([A-Za-z0-9_-]+)/)?.[1];
await fetch(`${BASE}/verify-email?token=${nicoToken}`);
r = await nico.req("/api/my/listings", { body: listingBody(nicoPhotos, { title: "Loft near Kapitolyo, Pasig" }) });
ok(r.status === 201, "after confirming, posting works", JSON.stringify(r.json));
const NICO_REF = r.json?.ref;

console.log("\n12. Account settings");
r = await nico.req("/api/account/profile", { method: "PATCH", body: { name: "Nico R. Ramos" } });
ok(r.status === 200 && (await nico.req("/api/auth/me")).json.user.name === "Nico R. Ramos", "name can be changed");
r = await nico.req("/api/account/password", { body: { currentPassword: "wrong-pass-12", newPassword: "Kapitolyo-loft-88" } });
ok(r.status === 401, "changing password needs the current one", r.status);
r = await nico.req("/api/account/password", { body: { currentPassword: "Pasig-loft-4421", newPassword: "Kapitolyo-loft-88" } });
ok(r.status === 200, "password changed");
r = await new Client("198.51.100.221").req("/api/auth/login", { body: { email: nicoEmail, password: "Kapitolyo-loft-88" } });
ok(r.status === 200, "new password works for log in");
const newPhone = "0918" + rand();
r = await nico.req("/api/account/phone", { body: { phone: newPhone } });
ok(r.status === 200 && /^\d{6}$/.test(r.json?.devCode), "adding a number texts a code", JSON.stringify(r.json));
const phoneCode = r.json.devCode;
r = await nico.req("/api/account/phone/verify", { body: { phone: newPhone, code: phoneCode === "000000" ? "111111" : "000000" } });
ok(r.status === 400, "wrong code doesn't change the number", r.status);
r = await nico.req("/api/account/phone/verify", { body: { phone: newPhone, code: phoneCode } });
ok(r.status === 200 && (await nico.req("/api/auth/me")).json.user.phone?.endsWith(newPhone.slice(-7)), "right code saves the number");
r = await ec.req("/api/auth/login", { body: { email: em, password: "Brand-new-pass-5" } });
r = await ec.req("/api/account/phone", { body: { phone: newPhone } });
ok(r.status === 409, "a number already on another account is refused", r.status);
const prc = "REB-" + rand();
r = await ec.req("/api/account/agent", { body: { prcLicenseNo: prc } });
ok(r.status === 200 && (await ec.req("/api/auth/me")).json.user.role === "AGENT", "owner can switch to an agent account");
ok((await mod.req("/admin?tab=agents")).text.includes(prc), "their license shows up for moderators to check");
r = await nico.req("/api/account/export");
ok(r.status === 200 && r.json?.user?.email === nicoEmail && r.json.listings.length === 1 && !r.text.includes("passwordHash"), "data download has their data and no password hash");
const nico2 = new Client("198.51.100.222");
await nico2.req("/api/auth/login", { body: { email: nicoEmail, password: "Kapitolyo-loft-88" } });
r = await nico.req("/api/account/sessions", { body: {} });
ok(r.status === 200 && r.json.ended >= 1 && (await nico2.req("/api/auth/me")).json.user === null, "sign out other devices ends the other session");
ok((await nico.req("/api/auth/me")).json.user !== null, "…but keeps this one");
r = await nico.req("/api/account/delete", { body: { confirm: "DELETE", password: "wrong-pass-12" } });
ok(r.status === 401, "deleting needs the password", r.status);
r = await nico.req("/api/account/delete", { body: { confirm: "DELETE", password: "Kapitolyo-loft-88" } });
ok(r.status === 200 && (await nico.req("/api/auth/me")).json.user === null, "account deleted and signed out");
ok((await nico.req(`/api/listings/${NICO_REF}`)).status === 404, "their listing is gone from the site");
r = await new Client("198.51.100.223").req("/api/auth/login", { body: { email: nicoEmail, password: "Kapitolyo-loft-88" } });
ok(r.status === 401, "the deleted account can't log in");
const gone = await db.user.findFirst({ where: { auditLogs: { some: { action: "user.delete" } } }, orderBy: { updatedAt: "desc" }, select: { name: true, email: true, phone: true, status: true } });
ok(gone?.status === "DELETED" && gone.email === null && gone.phone === null && gone.name === "Deleted user", "personal details are erased");
r = await new Client("198.51.100.224").req("/api/auth/signup", { body: { name: "Nico Ramos", email: nicoEmail, password: "Fresh-start-2026", role: "SEEKER" } });
ok(r.status === 201, "the email can be used for a new account");

console.log("\n13. Listing view counts");
const VIEW_REF = "PN-10005";
const before = (await db.listing.findUnique({ where: { refCode: VIEW_REF }, select: { viewCount: true } })).viewCount;
const browserUA = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36" };
for (let i = 0; i < 3; i++) await fetch(`${BASE}/api/listings/${VIEW_REF}/view`, { method: "POST", headers: browserUA });
await fetch(`${BASE}/api/listings/${VIEW_REF}/view`, { method: "POST", headers: { "User-Agent": "Googlebot/2.1" } });
await wait(17000); // the counter writes every 15 s
const after = (await db.listing.findUnique({ where: { refCode: VIEW_REF }, select: { viewCount: true, dailyStats: { orderBy: { date: "desc" }, take: 1 } } }));
ok(after.viewCount === before + 3, "views are counted (bots aren't)", `${before} → ${after.viewCount}`);
ok((after.dailyStats[0]?.views ?? 0) >= 3, "daily view stats are recorded for owner charts");

console.log("\n14. Admin user management");
const admin = new Client("203.0.113.61");
r = await admin.req("/api/auth/login", { body: { email: "admin@example.com", password: "Nest-demo-2026" } });
ok(r.status === 200, "admin logs in");
const cat = await db.user.findFirst({ where: { name: "Copy Cat" }, orderBy: { createdAt: "desc" }, select: { id: true } });
const adminUser = await db.user.findFirst({ where: { email: "admin@example.com" }, select: { id: true } });
ok((await mod.req("/admin?tab=users&q=Copy")).text.includes("Copy Cat"), "moderator can search users");
r = await mod.req(`/api/admin/users/${cat.id}`, { body: { action: "suspend", reason: "Reused another agent's photos." } });
ok(r.status === 200, "moderator suspends a scam account", JSON.stringify(r.json));
ok((await other.req("/api/auth/me")).json.user === null, "the suspended account is signed out");
const catRow = await db.user.findUnique({ where: { id: cat.id }, select: { status: true, statusReason: true, phone: true } });
ok(catRow.status === "SUSPENDED" && catRow.statusReason === "Reused another agent's photos.", "status and reason are saved");
r = await mod.req(`/api/admin/users/${adminUser.id}`, { body: { action: "suspend", reason: "Should not be allowed." } });
ok(r.status === 403, "a moderator can't suspend an admin", r.status);
r = await mod.req(`/api/admin/users/${cat.id}`, { body: { action: "role", role: "MODERATOR" } });
ok(r.status === 403, "a moderator can't change roles", r.status);
r = await admin.req(`/api/admin/users/${adminUser.id}`, { body: { action: "role", role: "SEEKER" } });
ok(r.status === 400, "an admin can't change their own role", r.status);
r = await admin.req(`/api/admin/users/${cat.id}`, { body: { action: "reactivate" } });
ok(r.status === 200 && (await db.user.findUnique({ where: { id: cat.id }, select: { status: true } })).status === "ACTIVE", "admin reactivates the account");
const activity = (await mod.req("/admin?tab=activity&action=user.")).text;
ok(activity.includes("Suspended an account") && activity.includes("Reactivated an account"), "both actions appear in the activity log");
ok((await mod.req(`/admin/users/${cat.id}`)).text.includes("Reused another agent"), "user page shows their history");
ok((await ec.req(`/admin/users/${cat.id}`)).status >= 300 && (await ec.req("/api/auth/me")).json.user !== null, "a signed-in non-staff user can't open user pages");

await db.$disconnect();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
