"use client";

export async function postJson(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Something went wrong. Please try again.");
  return data;
}

/** Only same-site paths are allowed as a destination after sign-in. */
export function safeNext(next: string | undefined | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/account";
}
