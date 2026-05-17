import { NextResponse, type NextRequest } from "next/server";
import { publicApi } from "@/lib/api";
import { clearSessionCookies, getRefreshToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const refreshToken = await getRefreshToken();
  if (refreshToken) {
    try {
      await publicApi.auth.logout(refreshToken);
    } catch (err) {
      console.error("logout revoke failed", err);
    }
  }
  await clearSessionCookies();
  return NextResponse.redirect(new URL("/", req.url), { status: 303 });
}
