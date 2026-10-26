import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, readJson } from "@/lib/api";
import { apiUser, HttpError, STAFF_ROLES } from "@/lib/auth";
import { db } from "@/lib/db";
import { enqueue } from "@/lib/jobs";

const schema = z.object({ verified: z.boolean(), note: z.string().trim().max(300).optional() });

/**
 * POST /api/admin/agents/:userId { verified } → moderator confirms (or rejects) an agent's PRC license
 * after checking it on the PRC online verification service.
 */
export const POST = handle(async (req: Request, { params }: { params: Promise<{ userId: string }> }) => {
  const mod = await apiUser(STAFF_ROLES);
  const { verified, note } = schema.parse(await readJson(req));
  const userId = (await params).userId;
  const profile = await db.agentProfile.findUnique({ where: { userId }, select: { prcLicenseNo: true, user: { select: { phone: true } } } });
  if (!profile) throw new HttpError(404, "Agent not found.");

  await db.$transaction(async (tx) => {
    await tx.agentProfile.update({ where: { userId }, data: { licenseVerifiedAt: verified ? new Date() : null } });
    await tx.auditLog.create({
      data: { actorId: mod.id, action: verified ? "agent.verify" : "agent.reject", entityType: "User", entityId: userId, data: { prcLicenseNo: profile.prcLicenseNo, note } },
    });
    if (profile.user.phone) {
      await enqueue("sms.send", {
        to: profile.user.phone,
        body: verified
          ? "PropertyNest: Your PRC license is verified. Your listings now show the Verified Agent badge."
          : `PropertyNest: We couldn't verify PRC license ${profile.prcLicenseNo}.${note ? " " + note : ""} Update it in your account.`,
      }, { tx });
    }
  });
  return NextResponse.json({ ok: true });
});
