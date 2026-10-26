"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { MODES, MODE_KEYS, MODE_TYPES, TYPES, type Mode } from "@/lib/catalog";
import { useFavorites } from "./favorites";
import { Icon } from "./Icon";

const EXTRAS: Record<Mode, { all: string; links: [string, string][] }> = {
  buy: { all: "All properties for sale", links: [["/listings?mode=buy&sort=newest", "Newly listed"], ["/#calculator", "Home loan calculator"]] },
  rent: { all: "All properties for rent", links: [["/listings?mode=rent&furnishing=Fully%20Furnished", "Fully furnished"], ["/listings?mode=rent&pets=1", "Pet friendly"]] },
  lease: { all: "All properties for lease", links: [["/listings?mode=lease&amenities=PEZA%20Accredited", "PEZA-accredited spaces"], ["/listings?mode=lease&term=1", "1-year terms or shorter"]] },
};

export function HeaderNav({ counts }: { counts: Record<string, number> }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const activeMode = pathname === "/listings" ? params.get("mode") : null;
  const savedPage = pathname === "/saved";
  const favCount = useFavorites().length;
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<Mode | null>(null);
  const navRef = useRef<HTMLElement>(null);

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
      <nav className={`main-nav ${mobileOpen ? "open" : ""}`} ref={navRef}>
        {MODE_KEYS.map((m) => (
          <div key={m} className={`nav-item ${openMenu === m ? "open" : ""}`}>
            <Link href={`/listings?mode=${m}`} className={`nav-link ${activeMode === m ? "active" : ""}`}>{MODES[m].label}</Link>
            <button
              type="button"
              className="nav-caret"
              aria-expanded={openMenu === m}
              aria-label={`Show ${MODES[m].label} options`}
              onClick={(e) => {
                e.stopPropagation();
                setOpenMenu(openMenu === m ? null : m);
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
