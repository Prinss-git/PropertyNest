import "server-only";
import { createHash } from "node:crypto";

/**
 * The visitor's IP, for rate limits. Which header to believe depends on what sits in front of the app,
 * because visitors can send any header they like; only the parts added by our own proxy are trustworthy.
 *   CLIENT_IP_HEADER=x-forwarded-for (default): the LAST address in X-Forwarded-For, which the host's
 *     proxy appends. Anything earlier in the list may have been made up by the visitor.
 *   CLIENT_IP_HEADER=cf-connecting-ip: behind Cloudflare (only if the server accepts traffic from Cloudflare only).
 *   CLIENT_IP_HEADER=x-real-ip: behind an nginx that sets it.
 */
export function clientIp(req: Request): string {
  const h = req.headers;
  const mode = process.env.CLIENT_IP_HEADER ?? "x-forwarded-for";
  if (mode === "cf-connecting-ip") return h.get("cf-connecting-ip") ?? "unknown";
  if (mode === "x-real-ip") return h.get("x-real-ip") ?? "unknown";
  const chain = h.get("x-forwarded-for")?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
  return chain.at(-1) ?? "unknown";
}

/** One-way hash so we can rate-limit and investigate abuse without storing raw IP addresses (Data Privacy Act). */
export function hashIp(ip: string): string {
  const salt = process.env.IP_HASH_SALT ?? "dev-only-salt";
  return createHash("sha256").update(salt + ip).digest("hex").slice(0, 32);
}
