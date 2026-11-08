"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { fetchMe } from "@/components/useMe";
import { toast } from "@/components/toast";

async function call(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Something went wrong. Please try again.");
  return data;
}

/** Busy/error state shared by the small forms on this page. */
function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run, errorBox: error ? <p className="form-error" role="alert">{error}</p> : null };
}

export function EmailVerifyButton() {
  const a = useAction();
  return (
    <>
      <button type="button" className="link-btn" disabled={a.busy} onClick={() => a.run(async () => {
        const d = await call("/api/account/resend-verification", "POST");
        toast(`Sent a new link to ${d.sentTo}`);
      })}>{a.busy ? "Sending…" : "Resend the link"}</button>
      {a.errorBox}
    </>
  );
}

export function ProfileSection({ name: initialName, email: initialEmail, emailVerified }: { name: string; email: string; emailVerified: boolean }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const a = useAction();
  const changed = name !== initialName || email !== initialEmail;
  return (
    <form className="settings-form" onSubmit={(e) => {
      e.preventDefault();
      a.run(async () => {
        const d = await call("/api/account/profile", "PATCH", {
          ...(name !== initialName ? { name } : {}),
          ...(email !== initialEmail ? { email } : {}),
        });
        toast(d.emailChanged ? "Saved. Check your inbox to confirm the new email." : "Saved");
        await fetchMe(true);
        router.refresh();
      });
    }}>
      <div className="form-grid two-col">
        <div className="field"><label htmlFor="s-name">Full name</label>
          <input className="input" id="s-name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={80} autoComplete="name" /></div>
        <div className="field"><label htmlFor="s-email">Email {initialEmail && (emailVerified ? <span className="pill ok">Confirmed</span> : <span className="pill warn">Not confirmed</span>)}</label>
          <input className="input" id="s-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={120} autoComplete="email" /></div>
      </div>
      {a.errorBox}
      <div><button className="btn btn-brand btn-sm" disabled={a.busy || !changed}>{a.busy ? "Saving…" : "Save profile"}</button></div>
    </form>
  );
}

export function PhoneSection({ hasPhone }: { hasPhone: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState<{ sentTo: string; devCode?: string } | null>(null);
  const [code, setCode] = useState("");
  const a = useAction();
  if (!open) return <button type="button" className="btn btn-outline btn-sm" onClick={() => setOpen(true)}>{hasPhone ? "Change number" : "Add a mobile number"}</button>;
  return sent ? (
    <form className="settings-form" onSubmit={(e) => {
      e.preventDefault();
      a.run(async () => {
        await call("/api/account/phone/verify", "POST", { phone, code });
        toast("Mobile number saved");
        setOpen(false);
        setSent(null);
        await fetchMe(true);
        router.refresh();
      });
    }}>
      <p className="muted" style={{ margin: 0 }}>We texted a 6-digit code to <strong>{sent.sentTo}</strong>.</p>
      {sent.devCode && <p className="dev-note">Development mode: no SMS is sent. Your code is <strong>{sent.devCode}</strong>.</p>}
      <div className="inline-row">
        <input className="input code-input small" inputMode="numeric" autoComplete="one-time-code" maxLength={6} aria-label="6-digit code"
          value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} required />
        <button className="btn btn-brand btn-sm" disabled={a.busy || code.length !== 6}>{a.busy ? "Checking…" : "Confirm"}</button>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => { setSent(null); setCode(""); }}>Back</button>
      </div>
      {a.errorBox}
    </form>
  ) : (
    <form className="settings-form" onSubmit={(e) => {
      e.preventDefault();
      a.run(async () => setSent(await call("/api/account/phone", "POST", { phone })));
    }}>
      <div className="inline-row">
        <input className="input" inputMode="tel" autoComplete="tel" placeholder="0917 123 4567" aria-label="New mobile number" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        <button className="btn btn-brand btn-sm" disabled={a.busy}>{a.busy ? "Sending…" : "Text me a code"}</button>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setOpen(false)}>Cancel</button>
      </div>
      {a.errorBox}
    </form>
  );
}

export function PasswordSection({ hasPassword, hasEmail }: { hasPassword: boolean; hasEmail: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const a = useAction();
  if (!hasEmail) return null;
  if (!open) return <div><button type="button" className="btn btn-outline btn-sm" onClick={() => setOpen(true)}>{hasPassword ? "Change password" : "Set a password"}</button></div>;
  return (
    <form className="settings-form" onSubmit={(e) => {
      e.preventDefault();
      a.run(async () => {
        await call("/api/account/password", "POST", { currentPassword: hasPassword ? current : undefined, newPassword: next });
        toast(hasPassword ? "Password changed" : "Password set. You can now log in with your email.");
        setOpen(false);
        setCurrent("");
        setNext("");
        router.refresh();
      });
    }}>
      <div className="form-grid two-col">
        {hasPassword && (
          <div className="field"><label htmlFor="s-cur">Current password</label>
            <input className="input" id="s-cur" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required /></div>
        )}
        <div className="field"><label htmlFor="s-new">New password</label>
          <input className="input" id="s-new" type="password" autoComplete="new-password" minLength={8} value={next} onChange={(e) => setNext(e.target.value)} required />
          <span className="fine">At least 8 characters, with some letters.</span></div>
      </div>
      {a.errorBox}
      <div className="inline-row">
        <button className="btn btn-brand btn-sm" disabled={a.busy}>{a.busy ? "Saving…" : "Save password"}</button>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}

export function AgentSection({ role, prc, verified }: { role: string; prc: string | null; verified: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState(prc ?? "");
  const a = useAction();
  const isAgent = role === "AGENT";
  if (isAgent && verified) {
    return <p className="muted">Licensed agent. PRC license <strong>{prc}</strong> <span className="pill ok">Verified</span></p>;
  }
  return (
    <form className="settings-form" onSubmit={(e) => {
      e.preventDefault();
      a.run(async () => {
        await call("/api/account/agent", "POST", { prcLicenseNo: value });
        toast(isAgent ? "License number updated. A moderator will check it." : "You're now an agent account. A moderator will check your license.");
        await fetchMe(true);
        router.refresh();
      });
    }}>
      <p className="muted" style={{ margin: 0 }}>
        {isAgent
          ? <>Agent account. License <strong>{prc}</strong> <span className="pill warn">Waiting for a moderator to check it</span>. If you typed it wrong, fix it here.</>
          : <>You have a {role === "OWNER" ? "property owner" : "regular"} account. Licensed brokers and salespersons can switch to an agent account to list for clients (up to 30 listings) and get the Verified Agent badge.</>}
      </p>
      <div className="inline-row">
        <input className="input" aria-label="PRC license number" placeholder="PRC license number" value={value} onChange={(e) => setValue(e.target.value)} required />
        <button className="btn btn-brand btn-sm" disabled={a.busy || !value.trim()}>{a.busy ? "Saving…" : isAgent ? "Update license" : "Switch to agent account"}</button>
      </div>
      {a.errorBox}
    </form>
  );
}

export function DataSection({ sessions }: { sessions: number }) {
  const a = useAction();
  return (
    <div className="settings-rows">
      <div className="settings-row">
        <div><strong>Download your data</strong><span className="muted">Your profile, listings, inquiries and saved listings, as a JSON file.</span></div>
        <a className="btn btn-outline btn-sm" href="/api/account/export" download>Download</a>
      </div>
      <div className="settings-row">
        <div><strong>Signed-in devices</strong><span className="muted">{sessions} active session{sessions === 1 ? "" : "s"}, including this one.</span></div>
        <button type="button" className="btn btn-outline btn-sm" disabled={a.busy || sessions < 2} onClick={() => a.run(async () => {
          const d = await call("/api/account/sessions", "POST");
          toast(d.ended ? `Signed out ${d.ended} other device${d.ended === 1 ? "" : "s"}` : "No other devices were signed in");
        })}>Sign out other devices</button>
      </div>
      {a.errorBox}
    </div>
  );
}

export function DangerSection({ hasPassword }: { hasPassword: boolean }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [password, setPassword] = useState("");
  const a = useAction();
  if (!open) {
    return (
      <>
        <p className="muted">Removes your profile and contact details, takes your listings off the site, and signs you out everywhere. This can&apos;t be undone.</p>
        <button type="button" className="btn btn-outline btn-sm danger" onClick={() => setOpen(true)}>Delete my account</button>
      </>
    );
  }
  return (
    <form className="settings-form" onSubmit={(e) => {
      e.preventDefault();
      a.run(async () => {
        await call("/api/account/delete", "POST", { confirm, password: hasPassword ? password : undefined });
        window.location.href = "/?deleted=1";
      });
    }}>
      <p className="muted" style={{ margin: 0 }}>Type <strong>DELETE</strong> to confirm{hasPassword ? ", and enter your password" : ""}.</p>
      <div className="inline-row">
        <input className="input" aria-label="Type DELETE" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        {hasPassword && <input className="input" type="password" aria-label="Password" placeholder="Password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />}
        <button className="btn btn-sm danger-solid" disabled={a.busy || confirm !== "DELETE"}>{a.busy ? "Deleting…" : "Delete forever"}</button>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setOpen(false)}>Cancel</button>
      </div>
      {a.errorBox}
    </form>
  );
}
