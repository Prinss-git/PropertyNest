import "server-only";
import { createHash } from "node:crypto";

/** Client IP from the proxy headers (Cloudflare first, then the standard forwarded chain). */
export function clientIp(req: Request): string {
  const h = req.headers;
  return (
    h.get("cf-connecting-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    "unknown"
  );
}

/** One-way hash so we can rate-limit and investigate abuse without storing raw IP addresses (Data Privacy Act). */
export function hashIp(ip: string): string {
  const salt = process.env.IP_HASH_SALT ?? "dev-only-salt";
  return createHash("sha256").update(salt + ip).digest("hex").slice(0, 32);
}
