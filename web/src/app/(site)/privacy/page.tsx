import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy">
      <p>We handle personal data according to the Data Privacy Act of 2012 (RA 10173).</p>
      <h2>What we collect</h2>
      <p>Your name, mobile number, email, and (for agents) PRC license number; listings and photos you post; inquiries you send or receive; and basic usage data. Photo location data is removed when you upload.</p>
      <h2>Why</h2>
      <p>To run your account, show your listings, deliver inquiries between buyers or tenants and agents or owners, prevent fraud, and send service messages.</p>
      <h2>Sharing</h2>
      <p>When you send an inquiry, the agent or owner receives your name and contact details. We use service providers for SMS, email, and hosting. We don&apos;t sell personal data.</p>
      <h2>Your rights</h2>
      <p>You can ask to access, correct, or delete your data. Contact our Data Protection Officer at privacy@propertynest.ph.</p>
    </LegalPage>
  );
}
