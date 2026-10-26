"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { postJson } from "@/components/auth/forms";
import { fetchMe } from "@/components/useMe";

export function ResetForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  return (
    <form className="auth-form" onSubmit={async (e) => {
      e.preventDefault();
      if (password !== confirm) return setError("The two passwords don't match.");
      setBusy(true);
      setError("");
      try {
        await postJson("/api/auth/reset", { token, password });
        await fetchMe(true);
        router.replace("/account");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setBusy(false);
      }
    }}>
      <p className="auth-sub">Choose a new password. You&apos;ll be signed out on your other devices.</p>
      <div className="auth-field">
        <label htmlFor="password">New password</label>
        <input className="input" id="password" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus />
        <span className="fine">At least 8 characters, with some letters.</span>
      </div>
      <div className="auth-field">
        <label htmlFor="confirm">Confirm new password</label>
        <input className="input" id="confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="btn btn-brand btn-block" disabled={busy}>{busy ? "Saving…" : "Save password and log in"}</button>
    </form>
  );
}
