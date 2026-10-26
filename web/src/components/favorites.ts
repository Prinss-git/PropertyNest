"use client";
import { useSyncExternalStore } from "react";

// Favorites are kept in localStorage so they work signed out. Once signed in, they're merged into
// the account (Favorite table) and every toggle is mirrored to the server.
const KEY = "pn_favs";
const listeners = new Set<() => void>();
let cache: string[] | null = null;
let signedIn = false;

function read(): string[] {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    cache = [];
  }
  return cache!;
}

function write(ids: string[]) {
  cache = ids;
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    /* storage blocked; keep in memory for this tab */
  }
  listeners.forEach((l) => l());
}

async function pushToServer(body: { add?: string[]; remove?: string[] }): Promise<string[] | null> {
  try {
    const res = await fetch("/api/favorites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) return null;
    return (await res.json()).refs as string[];
  } catch {
    return null;
  }
}

/** Called once the header knows the visitor is signed in: merges this browser's saves into the account. */
export async function syncFavoritesWithAccount() {
  signedIn = true;
  const refs = await pushToServer({ add: read() });
  if (refs) write(refs);
}

export function signedOutFavorites() {
  signedIn = false;
}

export function toggleFavorite(ref: string): boolean {
  const ids = read();
  const on = !ids.includes(ref);
  write(on ? [...ids, ref] : ids.filter((x) => x !== ref));
  if (signedIn) void pushToServer(on ? { add: [ref] } : { remove: [ref] });
  return on;
}

const EMPTY: string[] = [];
export function useFavorites(): string[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      const onStorage = (e: StorageEvent) => {
        if (e.key === KEY) {
          cache = null;
          cb();
        }
      };
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(cb);
        window.removeEventListener("storage", onStorage);
      };
    },
    read,
    () => EMPTY,
  );
}
