import { createClient } from "@daegu-courses/api-client";

/** Server-side client (runs in RSC / Route Handlers). */
export const api = createClient({
  baseUrl: process.env.API_BASE_URL ?? "http://localhost:3000",
});

/** Browser-side client (use full origin). */
export function browserApi(userId?: string) {
  return createClient({
    baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000",
    userId,
  });
}
