"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { MODES, MODE_KEYS, MODE_TYPES, TYPES, type Mode } from "@/lib/catalog";
import { useFavorites } from "./favorites";
import { useMe } from "./useMe";
import { Icon } from "./Icon";

const EXTRAS: Record<Mode, { all: string; links: [string, string][] }> = {
  buy: { all: "All properties for sale", links: [["/listings?mode=buy&sort=newest", "Newly listed"], ["/#calculator", "Home loan calculator"]] },
  rent: { all: "All properties for rent", links: [["/listings?mode=rent&furnishing=Fully%20Furnished", "Fully furnished"], ["/listings?mode=rent&pets=1", "Pet friendly"]] },
  lease: { all: "All properties for lease", links: [["/listings?mode=lease&amenities=PEZA%20Accredited", "PEZA-accredited spaces"], ["/listings?mode=lease&term=1", "1-year terms or shorter"]] },
};

function AccountMenu() {
  const me = useMe();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const onClick = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  // Reserve the space while loading so the header doesn't jump.
  if (me === undefined) return <span className="account-slot" aria-hidden="true" />;
  if (!me) {
    return <Link href={`/login?next=${encodeURIComponent(pathname)}`} className="btn btn-outline btn-sm">Log in</Link>;
  }
  const staff = me.role === "MODERATOR" || me.role === "ADMIN";
  const poster = me.role !== "SEEKER";
  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  };
  return (
    <div className={`nav-item account-menu ${open ? "open" : ""}`} ref={ref}>
      <button type="button" className="icon-btn avatar-btn" aria-expanded={open} aria-label="Account menu" onClick={() => setOpen(!open)}>
        {me.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
      </button>
      <div className="nav-menu" role="menu">
        <div className="nav-menu-label">{me.name}</div>
        <Link href="/account" role="menuitem"><span>My account</span></Link>
        {poster && <Link href="/account#listings" role="menuitem"><span>My listings</span></Link>}
        {poster && <Link href="/account/leads" role="menuitem"><span>Inquiries (leads)</span></Link>}
        <Link href="/saved" role="menuitem"><span>Saved listings</span></Link>
        <Link href="/account/settings" role="menuitem"><span>Account settings</span></Link>
        {staff && <Link href="/admin" role="menuitem"><span>Moderation</span></Link>}
        <div className="nav-menu-sep" />
        <button type="button" className="nav-menu-btn" role="menuitem" onClick={signOut}>Sign out</button>
      </div>
    </div>
  );
}

export function HeaderNav({ counts }: { counts: Record<string, number> }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const activeMode = pathname === "/listings" ? params.get("mode") : null;
  const savedPage = pathname === "/saved";
  const favCount = useFavorites().length;
  const [mobileOpen, setMobileOpen] = useState(false);
  // The one menu that is open. Hover, the arrow button and keyboard focus all set this, so only one menu can
  // ever show at a time.
  const [openMenu, setOpenMenu] = useState<Mode | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPointer = useRef("");
  const cancelClose = () => { if (closeTimer.current) clearTimeout(closeTimer.current); closeTimer.current = null; };
  // A short delay before closing, so a mouse that slips off the edge on its way into the menu doesn't shut it.
  const closeSoon = () => { cancelClose(); closeTimer.current = setTimeout(() => setOpenMenu(null), 150); };
  useEffect(() => cancelClose, []);

  // Close menus on navigation, outside click, or Escape.
  useEffect(() => {
    setOpenMenu(null);
    setMobileOpen(false);
  }, [pathname, params]);
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!navRef.current?.contains(e.target as Node)) setOpenMenu(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenMenu(null);
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div className="container header-inner">
      <Link href="/" className="logo">
        <Icon name="logo" size={30} /> <b style={{ fontWeight: "inherit" }}>Property<span>Nest</span></b>
      </Link>
      <nav
        className={`main-nav ${mobileOpen ? "open" : ""}`}
        ref={navRef}
        // Focus moving out of the menus (Tab past them) closes them.
        onBlur={(e) => { if (!navRef.current?.contains(e.relatedTarget as Node | null)) setOpenMenu(null); }}
      >
        {MODE_KEYS.map((m) => (
          <div
            key={m}
            className={`nav-item ${openMenu === m ? "open" : ""}`}
            // Hover opens a menu only for a real mouse; on touch screens the arrow button toggles it.
            onPointerEnter={(e) => { if (e.pointerType === "mouse") { cancelClose(); setOpenMenu(m); } }}
            onPointerLeave={(e) => { if (e.pointerType === "mouse") closeSoon(); }}
            // Keyboard focus (Tab) opens the menu; a mouse click's focus doesn't, or it would undo the arrow's toggle.
            onFocus={(e) => { if ((e.target as HTMLElement).matches(":focus-visible")) { cancelClose(); setOpenMenu(m); } }}
          >
            <Link href={`/listings?mode=${m}`} className={`nav-link ${activeMode === m ? "active" : ""}`}>{MODES[m].label}</Link>
            <button
              type="button"
              className="nav-caret"
              aria-expanded={openMenu === m}
              aria-label={`Show ${MODES[m].label} options`}
              onPointerDown={(e) => { lastPointer.current = e.pointerType; }}
              onClick={(e) => {
                e.stopPropagation();
                cancelClose();
                // With a mouse the menu is already open from hovering, so a click keeps it open; touch and the
                // keyboard (Enter/Space) toggle it.
                if (lastPointer.current === "mouse") setOpenMenu(m);
                else setOpenMenu(openMenu === m ? null : m);
                lastPointer.current = "";
              }}
            >
              <Icon name="chevron" size={12} strokeWidth={2.5} />
            </button>
            <div className="nav-menu" role="menu">
              <div className="nav-menu-label">{MODES[m].verb}</div>
              {MODE_TYPES[m].map((t) => (
                <Link key={t} href={`/listings?mode=${m}&type=${t}`} role="menuitem">
                  <Icon name={TYPES[t].icon} size={16} />
                  <span>{TYPES[t].plural}</span>
                  <em>{counts[`${m}:${t}`] ?? 0}</em>
                </Link>
              ))}
              <div className="nav-menu-sep" />
              {EXTRAS[m].links.map(([href, label]) => (
                <Link key={href} href={href} className="nav-menu-extra" role="menuitem">{label}</Link>
              ))}
              <Link href={`/listings?mode=${m}`} className="nav-menu-all" role="menuitem">{EXTRAS[m].all} →</Link>
            </div>
          </div>
        ))}
        <Link href="/#calculator" className="nav-link">Home Loan Calculator</Link>
        <Link href="/#locations" className="nav-link">Locations</Link>
      </nav>
      <div className="header-actions">
        <Link href="/saved" className={`icon-btn ${savedPage ? "active" : ""}`} title="Saved listings" aria-label="Saved listings">
          <Icon name="heart" />
          {favCount > 0 && <span className="badge">{favCount}</span>}
        </Link>
        <AccountMenu />
        <Link href="/post" className="btn btn-primary btn-sm">
          <Icon name="plus" size={16} />
          <span className="btn-post-text">List Property</span>
        </Link>
        <button type="button" className="icon-btn menu-toggle" aria-label="Menu" aria-expanded={mobileOpen} onClick={() => setMobileOpen(!mobileOpen)}>
          <Icon name="menu" size={20} />
        </button>
      </div>
    </div>
  );
}
