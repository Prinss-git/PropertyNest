// Error reporting (Sentry) settings shared by the server, the browser and the worker.
// Off until NEXT_PUBLIC_SENTRY_DSN is set. The DSN is not a secret: Sentry designs it to sit in browser code.
// Privacy: no IP addresses, cookies or user details are sent (sendDefaultPii: false, plus the scrub below).

type SentryEvent = {
  user?: unknown;
  request?: { cookies?: unknown; headers?: Record<string, string>; data?: unknown; query_string?: unknown };
};

export const sentryDsn = () => process.env.NEXT_PUBLIC_SENTRY_DSN || undefined;

/** Removes anything that could identify a visitor before an error leaves the site. */
export function scrubEvent<E extends SentryEvent>(event: E): E {
  delete event.user;
  if (event.request) {
    delete event.request.cookies;
    delete event.request.data; // form bodies can hold names, phone numbers and passwords
    delete event.request.query_string;
    const headers = event.request.headers;
    if (headers) for (const h of Object.keys(headers)) if (/cookie|authorization|forwarded|real-ip|cf-connecting-ip/i.test(h)) delete headers[h];
  }
  return event;
}

export function sentryOptions() {
  const dsn = sentryDsn();
  return {
    dsn,
    enabled: !!dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || "production",
    // A small sample of page timings is enough to spot slow pages and stays inside Sentry's free tier.
    tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_RATE ?? "0.05"),
    sendDefaultPii: false,
    beforeSend: scrubEvent,
  };
}
