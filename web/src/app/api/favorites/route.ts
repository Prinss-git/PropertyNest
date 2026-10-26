import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, readJson } from "@/lib/api";
import { apiUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET → the signed-in user's saved listing refs.
export const GET = handle(async () => {
  const user = await apiUser();
  const favs = await db.favorite.findMany({ where: { userId: user.id }, select: { listing: { select: { refCode: true } } }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ refs: favs.map((f) => f.listing.refCode) }, { headers: { "Cache-Control": "private, no-store" } });
});

const body = z.object({ add: z.array(z.string().max(20)).max(200).default([]), remove: z.array(z.string().max(20)).max(200).default([]) });

// POST { add: [...refs], remove: [...refs] } → used for single toggles and for merging this browser's saves on sign-in.
export const POST = handle(async (req: Request) => {
  const user = await apiUser();
  const { add, remove } = body.parse(await readJson(req));
  const [toAdd, toRemove] = await Promise.all([
    add.length ? db.listing.findMany({ where: { refCode: { in: add } }, select: { id: true } }) : [],
    remove.length ? db.listing.findMany({ where: { refCode: { in: remove } }, select: { id: true } }) : [],
  ]);
  if (toAdd.length) {
    await db.favorite.createMany({ data: toAdd.map((l) => ({ userId: user.id, listingId: l.id })), skipDuplicates: true });
  }
  if (toRemove.length) {
    await db.favorite.deleteMany({ where: { userId: user.id, listingId: { in: toRemove.map((l) => l.id) } } });
  }
  const favs = await db.favorite.findMany({ where: { userId: user.id }, select: { listing: { select: { refCode: true } } } });
  return NextResponse.json({ refs: favs.map((f) => f.listing.refCode) });
});
