"use client";
import { useEffect, useSyncExternalStore } from "react";
import { signedOutFavorites, syncFavoritesWithAccount } from "./favorites";

export type Me = { name: string; role: string; phone: string | null } | null;

// Shared store: fetched once per page load, refreshed after sign-in, and every subscriber re-renders.
let current: Me | undefined = undefined;
let pending: Promise<Me> | null = null;
const listeners = new Set<() => void>();

/** Who's signed in. Pass force=true after signing in or out to refresh every component that uses it. */
export function fetchMe(force = false): Promise<Me> {
  if (!pending || force) {
    pending = fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => d.user as Me)
      .catch(() => null)
      .then((me) => {
        current = me;
        if (me) void syncFavoritesWithAccount();
        else signedOutFavorites();
        listeners.forEach((l) => l());
        return me;
      });
  }
  return pending;
}

/** undefined while loading, null when signed out. */
export function useMe(): Me | undefined {
  const me = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
    () => undefined,
  );
  useEffect(() => {
    void fetchMe();
  }, []);
  return me;
}
