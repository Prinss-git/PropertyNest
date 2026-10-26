import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { HttpError } from "./auth";

/** Wraps a route handler so thrown HttpErrors and validation errors become clean JSON responses. */
export function handle<Args extends unknown[]>(fn: (...args: Args) => Promise<Response>) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
      if (e instanceof ZodError) {
        const issue = e.issues[0];
        const field = issue?.path.join(".");
        return NextResponse.json({ error: issue?.message ?? "Check the form and try again.", field }, { status: 400 });
      }
      console.error(e);
      return NextResponse.json({ error: "Something went wrong on our side. Please try again." }, { status: 500 });
    }
  };
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, "Request body must be JSON.");
  }
}
