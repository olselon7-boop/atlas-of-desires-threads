import { NextRequest, NextResponse } from "next/server";
import { exchangeCode, exchangeLongLived } from "@/lib/threads";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  if (error) {
    return NextResponse.json({
      error,
      error_description: url.searchParams.get("error_description"),
    }, { status: 400 });
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = request.cookies.get("threads_oauth_state")?.value;

  if (!code) return NextResponse.json({ error: "Missing code" }, { status: 400 });
  if (!state || !expectedState || state !== expectedState) {
    return NextResponse.json({ error: "Invalid OAuth state" }, { status: 400 });
  }

  try {
    const short = await exchangeCode(code);
    const long = await exchangeLongLived(short.access_token);

    const response = NextResponse.json({
      message: "Threads authorization successful",
      user_id: short.user_id ?? null,
      token_type: long.token_type ?? null,
      expires_in: long.expires_in ?? null,
    });

    response.cookies.delete("threads_oauth_state");
    response.cookies.set("threads_access_token", long.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: long.expires_in ?? 60 * 60 * 24 * 30,
    });
    return response;
  } catch (error) {
    return NextResponse.json({
      error: "Threads token exchange failed",
      detail: error instanceof Error ? error.message : "Unknown error",
    }, { status: 502 });
  }
}
