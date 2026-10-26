import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Cookie policy" };

export default function CookiesPage() {
  return (
    <LegalPage title="Cookie policy">
      <h2>Cookies we use</h2>
      <p><strong>pn_session</strong> keeps you signed in (30 days). <strong>pn_oauth</strong> protects Google sign-in for 10 minutes. Both are required for the site to work.</p>
      <h2>Stored in your browser</h2>
      <p>Saved listings and your grid or list view preference are stored in your browser until you sign in. We don&apos;t use advertising cookies.</p>
    </LegalPage>
  );
}
