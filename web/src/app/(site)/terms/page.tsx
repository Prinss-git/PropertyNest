import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Terms and conditions" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms and conditions">
      <h2>Using PropertyNest</h2>
      <p>PropertyNest connects people who want to buy, rent, or lease property with owners and licensed agents. We don&apos;t own the listed properties and aren&apos;t a party to any sale, rental, or lease.</p>
      <h2>Posting listings</h2>
      <p>Only post property you own or are authorized to market. Agents must hold a valid PRC license under RA 9646 (Real Estate Service Act). Listings must be accurate, use your own photos, and must not ask for payment before a viewing. We may review, edit, hide, or remove listings that break these rules.</p>
      <h2>Accounts</h2>
      <p>Keep your sign-in details private. You&apos;re responsible for activity on your account. We may suspend accounts used for fraud or spam.</p>
      <h2>Paid features</h2>
      <p>Featured listings and agent plans are billed in advance and described on their purchase page.</p>
    </LegalPage>
  );
}
