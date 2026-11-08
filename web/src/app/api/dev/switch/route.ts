import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession, destroySession } from "@/lib/auth";
import { db } from "@/lib/db";
import { devToolsEnabled } from "@/lib/devTools";

// POST /api/dev/switch { userId } → logs in as that account without a password; { userId: null } logs out.
// Development only (see devTools.ts).
export async function POST(req: Request) {
  if (!devToolsEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { userId } = z.object({ userId: z.string().nullable() }).parse(await req.json());
  await destroySession();
  if (!userId) return NextResponse.json({ ok: true });
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, status: true } });
  if (!user || user.status !== "ACTIVE") return NextResponse.json({ error: "That account isn't active." }, { status: 400 });
  await createSession(user.id, { userAgent: "dev panel", ipHash: null });
  return NextResponse.json({ ok: true });
}
