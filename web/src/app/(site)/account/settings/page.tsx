import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { googleConfigured } from "@/lib/google";
import { formatPhMobile } from "@/lib/phone";
import {
  AgentSection, DangerSection, DataSection, EmailVerifyButton, PasswordSection, PhoneSection, ProfileSection,
} from "./SettingsSections";

export const metadata: Metadata = { title: "Account settings", robots: { index: false } };

const GOOGLE_MESSAGES: Record<string, [string, boolean]> = {
  linked: ["Google is now connected. You can log in with it.", true],
  in_use: ["That Google account is already connected to a different PropertyNest account.", false],
  cancelled: ["Connecting Google was cancelled.", false],
  failed: ["Connecting Google didn't work. Please try again.", false],
  unavailable: ["Google sign-in isn't set up on this site yet.", false],
};

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ google?: string }> }) {
  const me = await requireUser({ next: "/account/settings" });
  const u = await db.user.findUniqueOrThrow({
    where: { id: me.id },
    select: {
      name: true, email: true, phone: true, role: true, emailVerifiedAt: true, phoneVerifiedAt: true, passwordHash: true, googleId: true,
      agentProfile: { select: { prcLicenseNo: true, licenseVerifiedAt: true } },
      _count: { select: { sessions: true } },
    },
  });
  const google = (await searchParams).google;
  const googleMsg = google ? GOOGLE_MESSAGES[google] : undefined;
  const staff = u.role === "MODERATOR" || u.role === "ADMIN";

  return (
    <>
      <div className="page-head">
        <div className="container">
          <div className="breadcrumb"><Link href="/">Home</Link> / <Link href="/account">Account</Link> / Settings</div>
          <h1>Account settings</h1>
        </div>
      </div>
      <main className="container settings">
        {googleMsg && <div className={`notice ${googleMsg[1] ? "ok" : ""}`}>{googleMsg[0]}</div>}
        {!me.verified && (
          <div className="notice">
            Confirm your email to post listings. We sent a link to <strong>{u.email}</strong>. <EmailVerifyButton />
          </div>
        )}

        <section className="settings-card">
          <h2>Profile</h2>
          <ProfileSection name={u.name} email={u.email ?? ""} emailVerified={!!u.emailVerifiedAt} />
        </section>

        <section className="settings-card">
          <h2>Mobile number</h2>
          <p className="muted">
            {u.phone ? <>{formatPhMobile(u.phone)} {u.phoneVerifiedAt && <span className="pill ok">Verified</span>}</> : "No number yet."}{" "}
            Used for inquiry alerts and phone log in.
          </p>
          <PhoneSection hasPhone={!!u.phone} />
        </section>

        <section className="settings-card">
          <h2>Log in methods</h2>
          <div className="settings-rows">
            <div className="settings-row">
              <div><strong>Email and password</strong><span className="muted">{u.passwordHash ? "Set" : u.email ? "No password yet" : "Add an email first"}</span></div>
            </div>
            <PasswordSection hasPassword={!!u.passwordHash} hasEmail={!!u.email} />
            <div className="settings-row">
              <div><strong>Phone code (OTP)</strong><span className="muted">{u.phone ? `Codes go to ${formatPhMobile(u.phone)}` : "Add a mobile number above"}</span></div>
            </div>
            <div className="settings-row">
              <div><strong>Google</strong><span className="muted">{u.googleId ? "Connected" : googleConfigured() ? "Not connected" : "Not available on this site yet"}</span></div>
              {!u.googleId && googleConfigured() && <a className="btn btn-outline btn-sm" href="/api/auth/google?link=1">Connect Google</a>}
            </div>
          </div>
        </section>

        {!staff && (
          <section className="settings-card">
            <h2>Account type</h2>
            <AgentSection
              role={u.role}
              prc={u.agentProfile?.prcLicenseNo ?? null}
              verified={!!u.agentProfile?.licenseVerifiedAt}
            />
          </section>
        )}

        <section className="settings-card">
          <h2>Your data and devices</h2>
          <DataSection sessions={u._count.sessions} />
        </section>

        <section className="settings-card danger-zone">
          <h2>Delete account</h2>
          <DangerSection hasPassword={!!u.passwordHash} />
        </section>
      </main>
    </>
  );
}
