import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, readJson } from "@/lib/api";
import { apiUser, HttpError } from "@/lib/auth";
import { db } from "@/lib/db";

const schema = z.object({ status: z.enum(["NEW", "CONTACTED", "VIEWING_SCHEDULED", "CLOSED", "SPAM"]) });

// PATCH /api/my/inquiries/:id { status } → agent/owner updates a lead's progress.
export const PATCH = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await apiUser();
  const { status } = schema.parse(await readJson(req));
  const inq = await db.inquiry.findUnique({
    where: { id: (await params).id },
    select: { id: true, firstReplyAt: true, listing: { select: { posterId: true, agentId: true } } },
  });
  if (!inq || (inq.listing.posterId !== user.id && inq.listing.agentId !== user.id)) throw new HttpError(404, "Inquiry not found.");
  await db.inquiry.update({
    where: { id: inq.id },
    // First move off NEW counts as the reply time, used for agent response-rate stats.
    data: { status, firstReplyAt: inq.firstReplyAt ?? (status !== "NEW" ? new Date() : null) },
  });
  return NextResponse.json({ ok: true });
});
