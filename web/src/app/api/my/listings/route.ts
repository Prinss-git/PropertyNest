import { NextResponse } from "next/server";
import { handle, readJson } from "@/lib/api";
import { apiUser } from "@/lib/auth";
import { listingInputSchema } from "@/lib/listingInput";
import { saveListing } from "@/lib/myListings";

// POST /api/my/listings → create a listing (goes live, or to review if a check flags it).
export const POST = handle(async (req: Request) => {
  const user = await apiUser(["SEEKER", "OWNER", "AGENT", "AGENCY_ADMIN"]);
  const input = listingInputSchema.parse(await readJson(req));
  const result = await saveListing(user, input);
  return NextResponse.json(result, { status: 201 });
});
