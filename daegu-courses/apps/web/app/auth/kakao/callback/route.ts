import { NextResponse, type NextRequest } from "next/server";
import { publicApi } from "@/lib/api";
import { setSessionCookies } from "@/lib/auth";

/**
 * Receives the Kakao authorization code redirect, exchanges it on the
 * API server for our session tokens, and stores them in httpOnly cookies.
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", req.url));
  }

  const redirectUri = new URL("/auth/kakao/callback", req.nextUrl.origin).toString();

  try {
    const session = await publicApi.auth.kakaoCallback({ code, redirectUri });
    await setSessionCookies(session);
    return NextResponse.redirect(new URL("/", req.url));
  } catch (err) {
    console.error("kakao callback failed", err);
    return NextResponse.redirect(new URL("/login?error=exchange_failed", req.url));
  }
}
