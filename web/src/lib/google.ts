import "server-only";
import { db } from "./db";

// Sign in with Google (OAuth 2.0 authorization-code flow). Needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET
// from Google Cloud Console, with  <SITE_URL>/api/auth/google/callback  as an authorized redirect URI.

export const googleConfigured = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
export const googleRedirectUri = () => `${process.env.SITE_URL ?? "http://localhost:3000"}/api/auth/google/callback`;

export function googleAuthUrl(state: string) {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

type GoogleProfile = { sub: string; email?: string; email_verified?: boolean; name?: string; picture?: string };

export async function fetchGoogleProfile(code: string): Promise<GoogleProfile> {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code",
    }),
    signal: AbortSignal.timeout(10000),
  });
  const tokens = await tokenRes.json();
  if (!tokenRes.ok || !tokens.access_token) throw new Error(`Google token exchange failed: ${JSON.stringify(tokens).slice(0, 200)}`);
  // Fetched straight from Google over TLS with the fresh access token, so no ID-token signature check is needed.
  const infoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
    signal: AbortSignal.timeout(10000),
  });
  const info = await infoRes.json();
  if (!infoRes.ok || !info.sub) throw new Error("Google profile request failed");
  return info;
}

/** Finds the account for this Google login: by Google id, else by verified email (linking it), else creates one. */
export async function userForGoogle(p: GoogleProfile): Promise<string> {
  const byGoogle = await db.user.findUnique({ where: { googleId: p.sub }, select: { id: true } });
  if (byGoogle) return byGoogle.id;
  const email = p.email?.toLowerCase();
  if (email && p.email_verified) {
    const byEmail = await db.user.findUnique({ where: { email }, select: { id: true } });
    if (byEmail) {
      await db.user.update({ where: { id: byEmail.id }, data: { googleId: p.sub, emailVerifiedAt: new Date() } });
      return byEmail.id;
    }
  }
  const user = await db.user.create({
    data: {
      googleId: p.sub,
      email: email && p.email_verified ? email : null,
      emailVerifiedAt: p.email_verified ? new Date() : null,
      name: p.name || email?.split("@")[0] || "PropertyNest user",
      avatarUrl: p.picture,
      role: "SEEKER", // they become an owner on first post, or an agent from their account page
    },
    select: { id: true },
  });
  await db.auditLog.create({ data: { actorId: user.id, action: "user.signup", entityType: "User", entityId: user.id, data: { method: "google" } } });
  return user.id;
}
