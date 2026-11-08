import Link from "next/link";
import type { Metadata } from "next";
import { DevPanel } from "@/components/DevPanel";
import { devToolsEnabled } from "@/lib/devTools";

export const metadata: Metadata = { robots: { index: false } };

// Sign-in pages: a single centred card, no site navigation to distract from finishing.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-shell">
      <main className="auth-main">{children}</main>
      <footer className="auth-footer">
        <Link href="/terms">Terms and conditions</Link>
        <Link href="/privacy">Privacy policy</Link>
        <Link href="/cookies">Cookie policy</Link>
      </footer>
      {devToolsEnabled() && <DevPanel />}
    </div>
  );
}
