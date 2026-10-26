// Also used by prisma/seed.ts, so no "server-only" here (node:crypto keeps it off the client anyway).
import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";

// scrypt is built into Node and memory-hard, so stolen hashes are expensive to crack on GPUs.
// Stored as "scrypt$N$r$p$salt$hash" so parameters can be raised later without breaking old hashes.
const N = 16384, R = 8, P = 1, KEYLEN = 64;

function scrypt(password: string, salt: Buffer, keylen: number, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => scryptCb(password, salt, keylen, opts, (err, key) => (err ? reject(err) : resolve(key))));
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password.normalize("NFKC"), salt, KEYLEN, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 });
  return ["scrypt", N, R, P, salt.toString("base64"), hash.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) {
    // Still do the work, so response time doesn't reveal which emails have passwords.
    await hashPassword(password);
    return false;
  }
  const [algo, n, r, p, salt, hash] = stored.split("$");
  if (algo !== "scrypt") return false;
  const expected = Buffer.from(hash, "base64");
  const actual = await scrypt(password.normalize("NFKC"), Buffer.from(salt, "base64"), expected.length, { N: +n, r: +r, p: +p, maxmem: 64 * 1024 * 1024 });
  return timingSafeEqual(expected, actual);
}

/** Returns a reason the password is too weak, or null. */
export function passwordProblem(password: string, context: { email?: string; name?: string } = {}): string | null {
  if (password.length < 8) return "Use at least 8 characters.";
  if (password.length > 128) return "Use at most 128 characters.";
  if (/^\d+$/.test(password)) return "Use some letters, not only numbers.";
  const lower = password.toLowerCase();
  if (["password", "12345678", "qwertyui", "propertynest"].some((w) => lower.includes(w))) return "That password is too easy to guess.";
  if (context.email && lower.includes(context.email.split("@")[0].toLowerCase())) return "Don't use your email name in your password.";
  return null;
}
