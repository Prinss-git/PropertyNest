import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard, OtherMethods } from "@/components/auth/AuthCard";
import { SignupForm } from "./SignupForm";

export const metadata: Metadata = { title: "Create an account" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <>
      <AuthCard title="Create an account">
        <SignupForm next={next} />
        <OtherMethods next={next} label="Or sign up with" />
      </AuthCard>
      <p className="auth-switch">
        Already have an account? <Link href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`}>Log in</Link>
      </p>
    </>
  );
}
