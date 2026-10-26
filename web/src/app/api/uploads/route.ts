import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { handle } from "@/lib/api";
import { apiUser, HttpError } from "@/lib/auth";
import { db } from "@/lib/db";
import { publicUrl, putObject } from "@/lib/storage";

const MAX_BYTES = 12 * 1024 * 1024;
const MAX_PER_HOUR = 60;
const ACCEPTED = new Set(["jpeg", "png", "webp", "avif", "heif", "tiff"]);

/**
 * POST /api/uploads (multipart, field "file") → { id, url, width, height }
 * Each photo is re-encoded: rotated upright, resized to 1600px and 640px WebP, all metadata
 * (including GPS location from phone cameras) stripped. The original file is never stored.
 */
export const POST = handle(async (req: Request) => {
  const user = await apiUser();
  const recent = await db.upload.count({ where: { userId: user.id, createdAt: { gte: new Date(Date.now() - 3600e3) } } });
  if (recent >= MAX_PER_HOUR) throw new HttpError(429, "Upload limit reached. Try again in an hour.");

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "Choose a photo to upload.");
  if (file.size > MAX_BYTES) throw new HttpError(413, "That photo is over 12 MB. Choose a smaller one.");

  const input = Buffer.from(await file.arrayBuffer());
  let meta: sharp.Metadata;
  try {
    meta = await sharp(input).metadata();
  } catch {
    throw new HttpError(415, "That file isn't a photo we can read. Use JPG, PNG or WebP.");
  }
  if (!meta.format || !ACCEPTED.has(meta.format)) throw new HttpError(415, "Use a JPG, PNG or WebP photo.");
  if ((meta.width ?? 0) < 400 || (meta.height ?? 0) < 300) throw new HttpError(422, "That photo is too small. Use one at least 400 × 300 pixels.");

  const base = sharp(input, { failOn: "error" }).rotate();
  const [large, small] = await Promise.all([
    base.clone().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer({ resolveWithObject: true }),
    base.clone().resize({ width: 640, height: 640, fit: "inside", withoutEnlargement: true }).webp({ quality: 74 }).toBuffer(),
  ]);

  const id = randomBytes(12).toString("hex");
  const key = `u/${id}.webp`;
  await Promise.all([putObject(key, large.data), putObject(`u/${id}-sm.webp`, small)]);
  const upload = await db.upload.create({
    data: {
      userId: user.id,
      storageKey: key,
      width: large.info.width,
      height: large.info.height,
      bytes: large.data.length,
      contentHash: createHash("sha256").update(large.data).digest("hex"),
    },
  });
  return NextResponse.json({ id: upload.id, url: publicUrl(key), width: upload.width, height: upload.height }, { status: 201 });
});
