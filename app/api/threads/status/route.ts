import { NextRequest, NextResponse } from "next/server";
import { env, THREADS_API } from "@/lib/threads";

export async function GET(request: NextRequest) {
  const { appId, appSecret, redirectUri } = env();
  const cookieToken = request.cookies.get("threads_access_token")?.value;
  return NextResponse.json({
    configured: Boolean(appId && appSecret && redirectUri),
    hasAppId: Boolean(appId),
    hasAppSecret: Boolean(appSecret),
    hasAccessToken: Boolean(cookieToken || process.env.THREADS_ACCESS_TOKEN),
    redirectUri: redirectUri || null,
    apiHost: THREADS_API,
  });
}
