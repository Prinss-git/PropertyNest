import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { googleAuthUrl, googleConfigured } from "@/lib/google";

/** Only same-site paths are allowed as a destination after sign-in. */
const safeNext = (n: string | null) => (n && n.startsWith("/") && !n.startsWith("//") ? n : "/account");

// GET /api/auth/google?next=/post → redirects to Google's account chooser.
export async function GET(req: Request) {
  const next = safeNext(new URL(req.url).searchParams.get("next"));
  const site = process.env.SITE_URL ?? "http://localhost:3000";
  if (!googleConfigured()) return NextResponse.redirect(`${site}/login?error=google_unavailable&next=${encodeURIComponent(next)}`);

  // `state` ties Google's response to this browser, which blocks login-CSRF.
  const state = randomBytes(24).toString("base64url");
  (await cookies()).set("pn_oauth", JSON.stringify({ state, next }), {
    httpOnly: true,
    sameSite: "lax",
    secure: site.startsWith("https://"),
    path: "/api/auth/google",
    maxAge: 600,
  });
  return NextResponse.redirect(googleAuthUrl(state));
}
