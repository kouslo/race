/**
 * Minimal Expo Push client.
 *   https://docs.expo.dev/push-notifications/sending-notifications/
 *
 * Implemented without expo-server-sdk to keep the API dependency-light;
 * the wire format is small and stable.
 */
const PUSH_URL = "https://exp.host/--/api/v2/push/send";
const MAX_PER_BATCH = 100;

export type ExpoMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  badge?: number;
  channelId?: string;
  priority?: "default" | "normal" | "high";
};

export type ExpoTicket =
  | { status: "ok"; id: string }
  | {
      status: "error";
      message: string;
      details?: { error?: ExpoErrorCode; expoPushToken?: string };
    };

export type ExpoErrorCode =
  | "DeviceNotRegistered"
  | "MessageTooBig"
  | "MessageRateExceeded"
  | "InvalidCredentials";

export type SendResult = {
  tickets: ExpoTicket[];
  /** Tokens to deactivate (DeviceNotRegistered etc.). */
  invalidTokens: string[];
};

export function isExpoPushToken(token: string): boolean {
  return /^ExponentPushToken\[[^\]]+\]$/.test(token) || /^ExpoPushToken\[[^\]]+\]$/.test(token);
}

export async function sendExpoPush(messages: ExpoMessage[]): Promise<SendResult> {
  const tickets: ExpoTicket[] = [];
  const invalidTokens: string[] = [];
  const accessToken = process.env.EXPO_ACCESS_TOKEN;

  for (let i = 0; i < messages.length; i += MAX_PER_BATCH) {
    const chunk = messages.slice(i, i + MAX_PER_BATCH);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
    };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

    const res = await fetch(PUSH_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(chunk),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Expo push failed: ${res.status} ${text}`);
    }
    const body = (await res.json()) as { data?: ExpoTicket[] };
    const batchTickets = body.data ?? [];
    tickets.push(...batchTickets);

    batchTickets.forEach((t, idx) => {
      if (t.status === "error" && t.details?.error === "DeviceNotRegistered") {
        invalidTokens.push(chunk[idx]!.to);
      }
    });
  }

  return { tickets, invalidTokens };
}
