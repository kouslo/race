import type { Context } from "hono";
import { z } from "zod";
import { userIdHeader } from "@daegu-courses/api-schemas";

/** Resolve the calling user via X-User-Id header (UUID). */
export function getUserId(c: Context): string {
  const raw = c.req.header("x-user-id");
  const parsed = userIdHeader.safeParse(raw);
  if (!parsed.success) {
    throw new HttpError(401, "X-User-Id header is required (UUID)");
  }
  return parsed.data;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function jsonError(c: Context, status: number, message: string) {
  return c.json({ error: message }, status as 400 | 401 | 403 | 404 | 500);
}

export const zErr = (issues: z.ZodIssue[]) => ({
  error: "validation_failed",
  issues: issues.map((i) => ({ path: i.path.join("."), message: i.message })),
});
