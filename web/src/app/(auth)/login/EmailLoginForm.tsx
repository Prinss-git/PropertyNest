"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { postJson, safeNext } from "@/components/auth/forms";
import { fetchMe } from "@/components/useMe";

export function EmailLoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await postJson("/api/auth/login", { email, password });
      await fetchMe(true);
      router.replace(safeNext(next));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="auth-form">
      <div className="auth-field">
        <label htmlFor="email">Email</label>
        <input className="input" id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
      </div>
      <div className="auth-field">
        <label htmlFor="password">Password</label>
        <input className="input" id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="auth-row">
        <Link href="/forgot-password" className="auth-link">Forgot password?</Link>
        <button className="btn btn-brand auth-submit" disabled={busy}>{busy ? "Logging in…" : "Log in"}</button>
      </div>
    </form>
  );
}
