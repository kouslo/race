import Constants from "expo-constants";
import { createClient } from "@daegu-courses/api-client";

const baseUrl =
  (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)?.apiBaseUrl ??
  "http://localhost:3000";

/**
 * Anonymous client for public endpoints (course listings, etc.) in places
 * where the auth context isn't easily reachable. For authenticated calls
 * prefer `useAuth().api`, which transparently attaches the access token
 * and refreshes when expired.
 */
export const publicApi = createClient({ baseUrl });

export { baseUrl };
