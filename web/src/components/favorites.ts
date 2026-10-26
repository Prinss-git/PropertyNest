"use client";
import { useSyncExternalStore } from "react";

// Favorites live in localStorage until accounts arrive (Phase 1), then sync to the Favorite table.
const KEY = "pn_favs";
const listeners = new Set<() => void>();
let cache: string[] | null = null;

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

export function toggleFavorite(ref: string): boolean {
  const ids = read();
  const on = !ids.includes(ref);
  write(on ? [...ids, ref] : ids.filter((x) => x !== ref));
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
