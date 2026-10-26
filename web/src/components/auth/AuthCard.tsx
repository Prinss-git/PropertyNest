import Link from "next/link";
import { Icon } from "../Icon";

export function AuthCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="auth-card">
      <Link href="/" className="logo auth-logo" aria-label="PropertyNest home">
        <Icon name="logo" size={34} /> <b style={{ fontWeight: "inherit" }}>Property<span>Nest</span></b>
      </Link>
      <h1>{title}</h1>
      {children}
    </div>
  );
}

function GoogleG() {
  // Google's multi-colour "G", per their sign-in branding guidelines.
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z" />
    </svg>
  );
}

/** "Or sign in with" row. On the phone page, the second button switches back to email instead. */
export function OtherMethods({ next, from = "email", label = "Or sign in with" }: { next?: string; from?: "email" | "phone"; label?: string }) {
  const q = next ? `?next=${encodeURIComponent(next)}` : "";
  return (
    <>
      <div className="auth-divider"><span>{label}</span></div>
      <div className="auth-alt">
        {/* Plain <a>: this leaves the app for Google, so no client-side navigation or prefetch. */}
        <a className="alt-btn" href={`/api/auth/google${q}`}><GoogleG /> Google</a>
        {from === "phone"
          ? <Link className="alt-btn" href={`/login${q}`}><Icon name="mail" size={20} /> Email</Link>
          : <Link className="alt-btn" href={`/login/phone${q}`}><Icon name="phone" size={20} /> Phone OTP</Link>}
      </div>
    </>
  );
}
