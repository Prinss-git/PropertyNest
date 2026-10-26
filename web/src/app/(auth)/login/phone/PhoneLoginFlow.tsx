"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { postJson, safeNext } from "@/components/auth/forms";
import { RolePicker, type SignupRole } from "@/components/auth/RolePicker";
import { fetchMe } from "@/components/useMe";

type Step = "phone" | "code" | "profile";

/** Phone OTP: number → 6-digit code → (first time only) name and account type. */
export function PhoneLoginFlow({ next }: { next?: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<SignupRole>("SEEKER");
  const [prc, setPrc] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const sendCode = () => run(async () => {
    const d = await postJson("/api/auth/otp", { phone });
    setSentTo(d.sentTo);
    setDevCode(d.devCode ?? null);
    setCode("");
    setStep("code");
  });

  const verify = (withProfile = false) => run(async () => {
    const d = await postJson("/api/auth/verify", {
      phone, code,
      ...(withProfile ? { name, email, role, prcLicenseNo: role === "AGENT" ? prc : undefined } : {}),
    });
    if (d.needsProfile) {
      setStep("profile");
      return;
    }
    await fetchMe(true);
    router.replace(safeNext(next));
    router.refresh();
  });

  const errorBox = error && <p className="form-error" role="alert">{error}</p>;

  if (step === "phone") {
    return (
      <form className="auth-form" onSubmit={(e) => { e.preventDefault(); sendCode(); }}>
        <p className="auth-sub">We&apos;ll text you a 6-digit code. No password needed.</p>
        <div className="auth-field">
          <label htmlFor="phone">Mobile number</label>
          <input className="input" id="phone" inputMode="tel" autoComplete="tel" placeholder="0917 123 4567" value={phone} onChange={(e) => setPhone(e.target.value)} required autoFocus />
        </div>
        {errorBox}
        <button className="btn btn-brand btn-block" disabled={busy}>{busy ? "Sending…" : "Text me a code"}</button>
      </form>
    );
  }

  if (step === "code") {
    return (
      <form className="auth-form" onSubmit={(e) => { e.preventDefault(); verify(); }}>
        <p className="auth-sub">We sent a 6-digit code to <strong>{sentTo}</strong>.</p>
        {devCode && <p className="dev-note">Development mode: no SMS is sent. Your code is <strong>{devCode}</strong>.</p>}
        <div className="auth-field">
          <label htmlFor="code">6-digit code</label>
          <input className="input code-input" id="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="\d{6}"
            value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} required autoFocus />
        </div>
        {errorBox}
        <button className="btn btn-brand btn-block" disabled={busy || code.length !== 6}>{busy ? "Checking…" : "Continue"}</button>
        <div className="auth-row">
          <button type="button" className="auth-link link-btn" onClick={() => { setStep("phone"); setError(""); }}>Change number</button>
          <button type="button" className="auth-link link-btn" onClick={sendCode} disabled={busy}>Send a new code</button>
        </div>
      </form>
    );
  }

  return (
    <form className="auth-form" onSubmit={(e) => { e.preventDefault(); verify(true); }}>
      <p className="auth-sub">Your number is confirmed. Tell us a bit about you.</p>
      <div className="auth-field">
        <label htmlFor="name">Full name</label>
        <input className="input" id="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} autoFocus />
      </div>
      <div className="auth-field">
        <label htmlFor="email">Email (optional, for inquiry alerts)</label>
        <input className="input" id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <RolePicker role={role} onRole={setRole} prc={prc} onPrc={setPrc} />
      {errorBox}
      <button className="btn btn-brand btn-block" disabled={busy}>{busy ? "Creating…" : "Create account"}</button>
    </form>
  );
}
