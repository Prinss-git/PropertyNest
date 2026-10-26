import type { Metadata } from "next";
import { AuthCard, OtherMethods } from "@/components/auth/AuthCard";
import { PhoneLoginFlow } from "./PhoneLoginFlow";

export const metadata: Metadata = { title: "Log in with phone" };

export default async function PhoneLoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <AuthCard title="Log in with phone">
      <PhoneLoginFlow next={next} />
      <OtherMethods next={next} from="phone" />
    </AuthCard>
  );
}
