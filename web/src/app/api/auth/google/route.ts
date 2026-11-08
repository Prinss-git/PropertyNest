import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { googleAuthUrl, googleConfigured } from "@/lib/google";

/** Only same-site paths are allowed as a destination after sign-in. */
const safeNext = (n: string | null) => (n && n.startsWith("/") && !n.startsWith("//") ? n : "/account");

// GET /api/auth/google?next=/post → redirects to Google's account chooser.
// GET /api/auth/google?link=1 → same, but connects Google to the signed-in account (Account settings).
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const next = safeNext(params.get("next"));
  const site = process.env.SITE_URL ?? "http://localhost:3000";
  const me = params.get("link") === "1" ? await getCurrentUser() : null;
  if (params.get("link") === "1" && !me) return NextResponse.redirect(`${site}/login?next=/account/settings`);
  if (!googleConfigured()) {
    return NextResponse.redirect(me ? `${site}/account/settings?google=unavailable` : `${site}/login?error=google_unavailable&next=${encodeURIComponent(next)}`);
  }

  // `state` ties Google's response to this browser, which blocks login-CSRF.
  const state = randomBytes(24).toString("base64url");
  (await cookies()).set("pn_oauth", JSON.stringify({ state, next, ...(me ? { link: me.id } : {}) }), {
    httpOnly: true,
    sameSite: "lax",
    secure: site.startsWith("https://"),
    path: "/api/auth/google",
    maxAge: 600,
  });
  return NextResponse.redirect(googleAuthUrl(state));
}
