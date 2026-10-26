// Stroke icons ported from the prototype. Paths are static strings, never user input.
const PATHS: Record<string, string> = {
  house: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  building: '<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M10 21v-3h4v3"/>',
  apartment: '<rect x="3" y="7" width="8" height="14"/><rect x="11" y="3" width="10" height="18"/><path d="M6 11h2M6 15h2M14 7h2M14 11h2M14 15h2M18 7h0M18 11h0"/>',
  townhouse: '<path d="M2 12l5-5 5 5M12 12l5-5 5 5"/><path d="M4 11v9h16v-9"/><path d="M7 20v-4M17 20v-4"/>',
  lot: '<path d="M3 20h18"/><path d="M5 20V9l4-3 4 3v11"/><path d="M15 20v-6l3-2 3 2v6" opacity=".5"/><path d="M3 4h4M17 4h4"/>',
  store: '<path d="M3 9l1.5-5h15L21 9"/><path d="M3 9a3 3 0 006 0 3 3 0 006 0 3 3 0 006 0"/><path d="M5 12v8h14v-8"/><path d="M10 20v-5h4v5"/>',
  office: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2"/><path d="M3 13h18"/>',
  warehouse: '<path d="M2 9l10-5 10 5v11H2z"/><path d="M6 20v-8h12v8M6 15h12"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.5-4.5"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 000-7.8z"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0114 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  bed: '<path d="M3 18V7M3 14h18v4M21 14v-3a3 3 0 00-3-3h-7v6"/><circle cx="7" cy="11" r="2"/>',
  bath: '<path d="M4 12h16v3a5 5 0 01-5 5H9a5 5 0 01-5-5z"/><path d="M6 12V5a2 2 0 014 0"/><path d="M7 20l-1 2M17 20l1 2"/>',
  area: '<path d="M3 3h6M3 3v6M21 21h-6M21 21v-6M3 3l7 7M21 21l-7-7"/>',
  land: '<path d="M3 17l6-6 4 4 8-8"/><path d="M3 21h18"/>',
  camera: '<path d="M4 7h3l2-3h6l2 3h3v12H4z"/><circle cx="12" cy="13" r="3.5"/>',
  check: '<path d="M5 12l5 5L20 7"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  filter: '<path d="M3 5h18M6 12h12M10 19h4"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M15 8l2 2"/>',
  tag: '<path d="M3 12V3h9l9 9-9 9z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
  walk: '<circle cx="13" cy="4" r="2"/><path d="M7 21l3-7 3 3v4M6 12l3-4 4 1 2 4 3 1M10 14l1-5"/>',
  target: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  map: '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
  logo: '<path d="M4 13l12-9 12 9" stroke-width="3"/><path d="M8 11v14h16V11" stroke-width="3"/><circle cx="16" cy="18" r="3.2" fill="#ff6b4a" stroke="none"/>',
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18, strokeWidth = 1.8 }: { name: IconName | string; size?: number; strokeWidth?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={name === "logo" ? "0 0 32 32" : "0 0 24 24"}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: PATHS[name] ?? "" }}
    />
  );
}
