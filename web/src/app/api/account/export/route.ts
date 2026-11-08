import { exportData } from "@/lib/account";
import { handle } from "@/lib/api";
import { apiUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/account/export → downloads everything we hold about the signed-in user, as JSON.
export const GET = handle(async () => {
  const user = await apiUser();
  const data = await exportData(user.id);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="propertynest-data-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
});
