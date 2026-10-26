import { getObject, KEY_PATTERN } from "@/lib/storage";

// Serves locally stored photos. In production a CDN (or R2/S3 public bucket) serves these instead.
export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const key = (await params).key.join("/");
  if (!KEY_PATTERN.test(key)) return new Response("Not found", { status: 404 });
  const data = await getObject(key);
  if (!data) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": "image/webp",
      // Keys never change content, so browsers and CDNs can keep them forever.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
