/**
 * Creates the first admin on a fresh production database (or promotes an existing account):
 *   npm run create-admin -- --email you@example.com --name "Your Name"
 * Prints a one-time password for new accounts; log in and change it in Account settings.
 */
import { randomBytes } from "node:crypto";
import { db } from "../src/lib/db";
import { hashPassword } from "../src/lib/password";

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = arg("email")?.trim().toLowerCase();
  const name = arg("name")?.trim();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new Error('Usage: npm run create-admin -- --email you@example.com --name "Your Name"');
  }

  const existing = await db.user.findUnique({ where: { email }, select: { id: true, role: true, status: true } });
  if (existing) {
    if (existing.status !== "ACTIVE") throw new Error(`That account is ${existing.status.toLowerCase()}; reactivate it first.`);
    await db.user.update({ where: { id: existing.id }, data: { role: "ADMIN" } });
    await db.auditLog.create({ data: { action: "user.role_change", entityType: "User", entityId: existing.id, data: { from: existing.role, to: "ADMIN", via: "create-admin script" } } });
    console.log(`${email} is now an admin (was ${existing.role.toLowerCase()}). Log in with their usual method.`);
    return;
  }

  if (!name) throw new Error("New accounts need --name.");
  // 18 random characters from an unambiguous alphabet: strong, and easy to type once.
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const password = Array.from(randomBytes(18), (b) => alphabet[b % alphabet.length]).join("");
  const user = await db.user.create({
    data: { email, name, role: "ADMIN", passwordHash: await hashPassword(password), emailVerifiedAt: new Date() },
    select: { id: true },
  });
  await db.auditLog.create({ data: { action: "user.signup", entityType: "User", entityId: user.id, data: { role: "ADMIN", method: "create-admin script" } } });
  console.log(`Admin created: ${email}\nOne-time password: ${password}\nLog in at /login, then change the password in Account settings.`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
