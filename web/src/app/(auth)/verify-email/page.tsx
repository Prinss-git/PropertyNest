import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { HttpError } from "@/lib/auth";
import { verifyEmail } from "@/lib/emailAuth";

export const metadata: Metadata = { title: "Confirm your email" };
export const dynamic = "force-dynamic";

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  let message = "This link is incomplete. Open the link from your email again.";
  let ok = false;
  if (token) {
    try {
      await verifyEmail(token);
      ok = true;
      message = "Your email is confirmed. You'll get inquiry alerts and account notices there.";
    } catch (e) {
      message = e instanceof HttpError ? e.message : "Something went wrong. Please try the link again.";
    }
  }
  return (
    <AuthCard title={ok ? "Email confirmed" : "Couldn't confirm your email"}>
      <div className="auth-form">
        <p className="auth-sub">{message}</p>
        <Link className="btn btn-brand btn-block" href="/account">Go to my account</Link>
      </div>
    </AuthCard>
  );
}
