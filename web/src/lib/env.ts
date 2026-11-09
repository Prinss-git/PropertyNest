// Startup check of settings. On a real deployment (SITE_URL is https) a missing or unsafe setting stops the
// app and the worker from starting, instead of failing later in front of a customer.
// Used by src/instrumentation.ts (web app) and scripts/worker.ts, so no Next.js-only imports.

export type EnvReport = { errors: string[]; warnings: string[]; deployed: boolean };

export function checkEnv(env: NodeJS.ProcessEnv = process.env): EnvReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const site = env.SITE_URL ?? "";
  const deployed = site.startsWith("https://");
  const need = (name: string, why: string) => !env[name] && errors.push(`${name} is not set (${why}).`);

  need("DATABASE_URL", "where the database is");
  if (!site) warnings.push("SITE_URL is not set; links in emails and SMS will point at http://localhost:3000.");
  if (!deployed) return { errors, warnings, deployed };

  // Secrets: required and long enough to be unguessable.
  if (!env.OTP_SECRET || env.OTP_SECRET.length < 32) errors.push("OTP_SECRET must be at least 32 random characters (it protects SMS login codes).");
  if (!env.IP_HASH_SALT || env.IP_HASH_SALT.length < 16) errors.push("IP_HASH_SALT must be at least 16 random characters (it keeps visitor IPs private).");
  if (env.DEV_TOOLS === "1") errors.push("DEV_TOOLS=1 turns on the developer panel, which lets anyone log in as any account. Remove it.");
  if (env.OTP_DEV_ECHO === "1") errors.push("OTP_DEV_ECHO=1 shows login codes on screen. Remove it: anyone could log in as anyone.");

  // Messages must really go out.
  if (env.SMS_PROVIDER !== "semaphore") errors.push("SMS_PROVIDER must be \"semaphore\" (with \"console\", login codes and alerts are never sent).");
  else need("SEMAPHORE_API_KEY", "needed to send SMS");
  if (env.EMAIL_PROVIDER !== "resend") errors.push("EMAIL_PROVIDER must be \"resend\" (with \"console\", emails are never sent).");
  else {
    need("RESEND_API_KEY", "needed to send email");
    need("EMAIL_FROM", "the sender address, on a domain verified with Resend");
  }

  // Photos on local disk vanish when a cloud host redeploys, and aren't shared between servers.
  if ((env.STORAGE_DRIVER ?? "local") !== "s3") {
    warnings.push("STORAGE_DRIVER is \"local\": photos are saved on this server's disk. Use \"s3\" (Cloudflare R2 or AWS S3) unless the host gives you a permanent disk and you run one server.");
  } else {
    for (const v of ["S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"]) need(v, "needed for photo storage");
    if (!env.S3_ENDPOINT && !env.S3_REGION) errors.push("Set S3_ENDPOINT (Cloudflare R2) or S3_REGION (AWS S3).");
  }

  // The free OpenStreetMap services only allow light use.
  if (!env.NEXT_PUBLIC_MAP_TILE_URL) warnings.push("NEXT_PUBLIC_MAP_TILE_URL is not set: maps use OpenStreetMap's free tiles, which don't allow heavy traffic.");
  if ((env.NEARBY_PROVIDER ?? "nominatim") === "nominatim") warnings.push("NEARBY_PROVIDER is \"nominatim\" (free, ~1 request/second, light use only). Use \"geoapify\" with GEOAPIFY_API_KEY for real traffic.");
  if (env.NEARBY_PROVIDER === "geoapify") need("GEOAPIFY_API_KEY", "needed for nearby places");

  if (env.DEMO_MODE === "1") warnings.push("DEMO_MODE is \"1\": the footer says the listings are samples. Leave it empty on the live site; use it only on a staging copy.");
  if (!env.SUPPORT_EMAIL) warnings.push("SUPPORT_EMAIL is not set; contact messages are only visible under Moderation → Support.");
  if ((env.GOOGLE_CLIENT_ID && !env.GOOGLE_CLIENT_SECRET) || (!env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)) {
    errors.push("Set both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, or neither.");
  }
  return { errors, warnings, deployed };
}

/** Prints warnings and throws if anything would make the deployment unsafe or broken. */
export function assertEnv(where: string) {
  const { errors, warnings } = checkEnv();
  for (const w of warnings) console.warn(`[config] ${w}`);
  if (errors.length) {
    throw new Error(`[config] ${where} can't start safely:\n  - ${errors.join("\n  - ")}\nSee web/DEPLOY.md for every setting.`);
  }
}
