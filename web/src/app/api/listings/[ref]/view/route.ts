import { countView, isBot } from "@/lib/viewCounter";

// POST /api/listings/PN-10042/view → counts one view. Sent once per listing per browser per day by the page.
export async function POST(req: Request, { params }: { params: Promise<{ ref: string }> }) {
  const ref = decodeURIComponent((await params).ref);
  if (/^PN-[A-Z0-9]{3,10}$/.test(ref) && !isBot(req.headers.get("user-agent"))) countView(ref);
  return new Response(null, { status: 204 });
}
