"use client";
import { useId, useMemo, useRef, useState } from "react";
import type { LocationOption } from "@/lib/listings";
import { Icon } from "./Icon";

// Type-to-search location box: free text is always allowed (it is a search), the list only helps pick a place.
// Follows the ARIA combobox pattern: arrow keys move, Enter picks, Esc closes.

const ICON: Record<LocationOption["kind"], string> = { region: "map", province: "map", city: "pin", area: "target" };
const MAX = 8;

// Lower-case and drop accents, so "paranaque" finds "Parañaque".
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function rank(options: LocationOption[], query: string) {
  const q = fold(query.trim());
  if (!q) return { title: "Popular places", items: [...options].sort((a, b) => b.count - a.count).slice(0, MAX) };
  const scored: [number, LocationOption][] = [];
  for (const o of options) {
    const label = fold(o.label);
    const score = label.startsWith(q) ? 0 : label.split(/[\s-]+/).some((w) => w.startsWith(q)) ? 1 : label.includes(q) ? 2 : fold(o.hint).includes(q) ? 3 : -1;
    if (score >= 0) scored.push([score, o]);
  }
  scored.sort((a, b) => a[0] - b[0] || b[1].count - a[1].count || a[1].label.localeCompare(b[1].label));
  return { title: null, items: scored.slice(0, MAX).map(([, o]) => o) };
}

// Bold the part of the label that matches what was typed.
function Highlight({ text, query }: { text: string; query: string }) {
  const q = fold(query.trim());
  const at = q ? fold(text).indexOf(q) : -1;
  if (at < 0 || fold(text).length !== text.length) return <>{text}</>;
  return <>{text.slice(0, at)}<mark>{text.slice(at, at + q.length)}</mark>{text.slice(at + q.length)}</>;
}

type Props = { id: string; value: string; onChange: (v: string) => void; options: LocationOption[]; placeholder?: string };

export function LocationCombobox({ id, value, onChange, options, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const input = useRef<HTMLInputElement>(null);
  const listId = `${useId().replace(/:/g, "")}-places`;
  const { title, items } = useMemo(() => rank(options, value), [options, value]);
  const showList = open && (items.length > 0 || value.trim() !== "");

  const pick = (o: LocationOption) => {
    onChange(o.value);
    setOpen(false);
    setActive(-1);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (items.length ? (a + 1) % items.length : -1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (items.length ? (a <= 0 ? items.length - 1 : a - 1) : -1));
    } else if (e.key === "Enter" && showList && active >= 0 && items[active]) {
      // Enter on a highlighted place picks it; Enter otherwise submits the search as typed.
      e.preventDefault();
      pick(items[active]);
    } else if (e.key === "Escape" && showList) {
      e.preventDefault();
      setOpen(false);
      setActive(-1);
    }
  };

  return (
    <div className="combo">
      <input
        ref={input}
        className="input combo-input"
        id={id}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setActive(-1); }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onBlur={() => { setOpen(false); setActive(-1); }}
        onKeyDown={onKeyDown}
      />
      {value && (
        <button
          type="button"
          className="combo-clear"
          aria-label="Clear location"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => { onChange(""); setOpen(true); input.current?.focus(); }}
        >
          <Icon name="x" size={16} />
        </button>
      )}
      {showList && (
        <ul className="combo-list" id={listId} role="listbox" aria-label="Places">
          {title && <li className="combo-head" role="presentation">{title}</li>}
          {items.map((o, i) => (
            <li
              key={`${o.kind}:${o.label}:${o.hint}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={`combo-opt ${i === active ? "on" : ""}`}
              // mousedown, not click: picking must happen before the input loses focus and closes the list.
              onMouseDown={(e) => { e.preventDefault(); pick(o); }}
              onMouseEnter={() => setActive(i)}
            >
              <span className="combo-ico" aria-hidden="true"><Icon name={ICON[o.kind]} size={16} /></span>
              <span className="combo-text">
                <span className="combo-label"><Highlight text={o.label} query={value} /></span>
                <span className="combo-hint">{o.hint}</span>
              </span>
              <span className="combo-count">{o.count} {o.count === 1 ? "listing" : "listings"}</span>
            </li>
          ))}
          {items.length === 0 && (
            <li className="combo-empty" role="presentation">
              No matching places. Press <b>Search</b> to look for &ldquo;{value.trim()}&rdquo; anywhere.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
