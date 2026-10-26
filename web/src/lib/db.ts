import { PrismaClient } from "@prisma/client";

// One client per process. In dev, Next.js hot-reloads modules, so keep it on globalThis
// to avoid opening a new connection pool on every edit.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({ log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"] });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
