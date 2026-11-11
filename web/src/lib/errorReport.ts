// A hook for reporting errors that are caught and handled (so they would otherwise only reach the logs),
// such as a background job that gives up. The web server and the worker each plug in their Sentry client;
// with no reporter set this does nothing.

type Reporter = (error: unknown, context: Record<string, unknown>) => void;
let reporter: Reporter | null = null;

export function setErrorReporter(r: Reporter) {
  reporter = r;
}

export function reportError(error: unknown, context: Record<string, unknown> = {}) {
  try {
    reporter?.(error, context);
  } catch {
    // Reporting must never break the thing being reported on.
  }
}
