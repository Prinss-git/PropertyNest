// Runs in the browser before the app starts: reports crashes in visitors' browsers to Sentry (when configured).
import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "./lib/monitoring";

Sentry.init(sentryOptions());

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
