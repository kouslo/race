import { createClient } from "@daegu-courses/api-client";
import { getAccessToken } from "./auth";

/** Server-side client (runs in RSC / Route Handlers). Sends Bearer when present. */
export const api = createClient({
  baseUrl: process.env.API_BASE_URL ?? "http://localhost:3000",
  accessToken: () => getAccessToken(),
});

/** Unauthenticated server client for public endpoints. */
export const publicApi = createClient({
  baseUrl: process.env.API_BASE_URL ?? "http://localhost:3000",
});
