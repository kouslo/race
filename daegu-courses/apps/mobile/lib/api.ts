import Constants from "expo-constants";
import { createClient } from "@daegu-courses/api-client";

const baseUrl =
  (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)?.apiBaseUrl ??
  "http://localhost:3000";

export const api = createClient({ baseUrl });

export function userApi(userId: string) {
  return createClient({ baseUrl, userId });
}
