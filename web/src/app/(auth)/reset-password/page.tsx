import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { ResetForm } from "./ResetForm";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <AuthCard title="Choose a new password">
      {token ? (
        <ResetForm token={token} />
      ) : (
        <div className="auth-form">
          <p className="auth-sub">This link is incomplete. Open the link from your email again, or request a new one.</p>
          <Link className="btn btn-outline btn-block" href="/forgot-password">Request a new link</Link>
        </div>
      )}
    </AuthCard>
  );
}
