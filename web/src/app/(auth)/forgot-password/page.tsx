"use client";
import Link from "next/link";
import { useState } from "react";
import { AuthCard } from "@/components/auth/AuthCard";
import { postJson } from "@/components/auth/forms";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  return (
    <AuthCard title="Reset your password">
      {sent ? (
        <div className="auth-form">
          <p className="auth-sub">If an account uses <strong>{email}</strong>, we&apos;ve emailed it a link to choose a new password. The link works for 1 hour.</p>
          <p className="fine">No email after a few minutes? Check spam, or <Link href="/login/phone">log in with your phone</Link> instead.</p>
          <Link className="btn btn-outline btn-block" href="/login">Back to log in</Link>
        </div>
      ) : (
        <form className="auth-form" onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await postJson("/api/auth/forgot", { email });
            setSent(true);
          } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
          } finally {
            setBusy(false);
          }
        }}>
          <p className="auth-sub">Enter the email you signed up with and we&apos;ll send you a reset link.</p>
          <div className="auth-field">
            <label htmlFor="email">Email</label>
            <input className="input" id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="auth-row">
            <Link href="/login" className="auth-link">Back to log in</Link>
            <button className="btn btn-brand auth-submit" disabled={busy}>{busy ? "Sending…" : "Send link"}</button>
          </div>
        </form>
      )}
    </AuthCard>
  );
}
