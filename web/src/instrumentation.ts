import * as Sentry from "@sentry/nextjs";
import { setErrorReporter } from "./lib/errorReport";
import { sentryOptions } from "./lib/monitoring";

// Runs once when the Next.js server starts.
export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") {
    Sentry.init(sentryOptions());
    return;
  }
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
  Sentry.init(sentryOptions());
  setErrorReporter((error, context) => Sentry.captureException(error, { extra: context }));
}

// Errors thrown while rendering pages or handling API requests on the server.
export const onRequestError = Sentry.captureRequestError;
