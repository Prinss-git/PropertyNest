import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, readJson } from "@/lib/api";
import { apiUser } from "@/lib/auth";
import { listingInputSchema } from "@/lib/listingInput";
import { changeListingStatus, saveListing } from "@/lib/myListings";

type Ctx = { params: Promise<{ ref: string }> };

// PUT /api/my/listings/PN-XXXXXX → replace the listing's details.
export const PUT = handle(async (req: Request, { params }: Ctx) => {
  const user = await apiUser();
  const input = listingInputSchema.parse(await readJson(req));
  return NextResponse.json(await saveListing(user, input, (await params).ref));
});

const actionSchema = z.object({
  action: z.enum(["close", "renew", "archive"]),
  reason: z.enum(["SOLD", "RENTED", "LEASED", "WITHDRAWN"]).optional(),
});

// POST /api/my/listings/PN-XXXXXX { action } → close (sold/rented/leased), renew, or archive.
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const user = await apiUser();
  const { action, reason } = actionSchema.parse(await readJson(req));
  await changeListingStatus(user, (await params).ref, action, reason);
  return NextResponse.json({ ok: true });
});
