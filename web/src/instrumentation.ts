// Runs once when the Next.js server starts.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { assertEnv } = await import("./lib/env");
  try {
    assertEnv("The web app");
  } catch (e) {
    // Next.js would log this and keep serving 500s. Exit instead, so the host marks the deploy as failed
    // (and keeps the previous version running) rather than routing visitors to a broken server.
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
}
