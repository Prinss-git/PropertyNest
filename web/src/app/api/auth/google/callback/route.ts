import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createSession, getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fetchGoogleProfile, googleConfigured, userForGoogle } from "@/lib/google";
import { clientIp, hashIp } from "@/lib/request";

// GET /api/auth/google/callback?code=…&state=… → Google sends the user back here.
export async function GET(req: Request) {
  const site = process.env.SITE_URL ?? "http://localhost:3000";
  const fail = (reason: string) => NextResponse.redirect(`${site}/login?error=${reason}`);
  const linkResult = (result: string) => NextResponse.redirect(`${site}/account/settings?google=${result}`);
  if (!googleConfigured()) return fail("google_unavailable");

  const url = new URL(req.url);
  const jar = await cookies();
  let saved: { state?: string; next?: string; link?: string } = {};
  try {
    saved = JSON.parse(jar.get("pn_oauth")?.value ?? "{}");
  } catch {}
  jar.delete({ name: "pn_oauth", path: "/api/auth/google" });

  if (url.searchParams.get("error")) return saved.link ? linkResult("cancelled") : fail("google_cancelled");
  const code = url.searchParams.get("code");
  if (!code || !saved.state || saved.state !== url.searchParams.get("state")) return saved.link ? linkResult("failed") : fail("google_failed");

  // Connecting Google to the signed-in account (from Account settings), not signing in.
  if (saved.link) {
    const me = await getCurrentUser();
    if (!me || me.id !== saved.link) return linkResult("failed");
    try {
      const profile = await fetchGoogleProfile(code);
      const owner = await db.user.findUnique({ where: { googleId: profile.sub }, select: { id: true } });
      if (owner && owner.id !== me.id) return linkResult("in_use");
      await db.user.update({ where: { id: me.id }, data: { googleId: profile.sub } });
      await db.auditLog.create({ data: { actorId: me.id, action: "user.google_link", entityType: "User", entityId: me.id } });
      return linkResult("linked");
    } catch (e) {
      console.error("Google link failed:", e);
      return linkResult("failed");
    }
  }

  try {
    const profile = await fetchGoogleProfile(code);
    const userId = await userForGoogle(profile);
    const user = await db.user.findUnique({ where: { id: userId }, select: { status: true } });
    if (user?.status !== "ACTIVE") return fail("suspended");
    await createSession(userId, { ipHash: hashIp(clientIp(req)), userAgent: req.headers.get("user-agent") });
  } catch (e) {
    console.error("Google sign-in failed:", e);
    return fail("google_failed");
  }
  return NextResponse.redirect(`${site}${saved.next ?? "/account"}`);
}
