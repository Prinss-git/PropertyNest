"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { postJson, safeNext } from "@/components/auth/forms";
import { RolePicker, type SignupRole } from "@/components/auth/RolePicker";
import { fetchMe } from "@/components/useMe";

export function SignupForm({ next }: { next?: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<SignupRole>("SEEKER");
  const [prc, setPrc] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await postJson("/api/auth/signup", { name, email, password, role, prcLicenseNo: role === "AGENT" ? prc : undefined });
      await fetchMe(true);
      router.replace(safeNext(next ?? (role === "SEEKER" ? "/account" : "/post")));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="auth-form">
      <div className="auth-field">
        <label htmlFor="name">Full name</label>
        <input className="input" id="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} autoFocus />
      </div>
      <div className="auth-field">
        <label htmlFor="email">Email</label>
        <input className="input" id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="auth-field">
        <label htmlFor="password">Password</label>
        <div className="password-wrap">
          <input className="input" id="password" type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={8}
            value={password} onChange={(e) => setPassword(e.target.value)} required aria-describedby="pw-hint" />
          <button type="button" className="link-btn" onClick={() => setShowPassword(!showPassword)}>{showPassword ? "Hide" : "Show"}</button>
        </div>
        <span className="fine" id="pw-hint">At least 8 characters, with some letters.</span>
      </div>
      <RolePicker role={role} onRole={setRole} prc={prc} onPrc={setPrc} />
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="btn btn-brand btn-block" disabled={busy}>{busy ? "Creating account…" : "Create account"}</button>
      <p className="fine">
        By creating an account you agree to our <Link href="/terms">terms</Link> and <Link href="/privacy">privacy policy</Link>.
      </p>
    </form>
  );
}
