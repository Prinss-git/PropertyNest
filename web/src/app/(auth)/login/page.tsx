import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard, OtherMethods } from "@/components/auth/AuthCard";
import { EmailLoginForm } from "./EmailLoginForm";

export const metadata: Metadata = { title: "Log in" };

const ERRORS: Record<string, string> = {
  google_unavailable: "Google sign-in isn't set up yet. Use your email or phone for now.",
  google_cancelled: "Google sign-in was cancelled.",
  google_failed: "Google sign-in didn't work. Please try again.",
  suspended: "This account is suspended. Contact support.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <>
      <AuthCard title="Log in">
        {error && ERRORS[error] && <p className="form-error" role="alert">{ERRORS[error]}</p>}
        <EmailLoginForm next={next} />
        <OtherMethods next={next} />
      </AuthCard>
      <p className="auth-switch">
        New to PropertyNest? <Link href={`/signup${next ? `?next=${encodeURIComponent(next)}` : ""}`}>Create an account</Link>
      </p>
    </>
  );
}
