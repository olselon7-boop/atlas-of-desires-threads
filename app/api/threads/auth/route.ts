import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { buildAuthUrl } from "@/lib/threads";

export async function GET() {
  try {
    const state = crypto.randomBytes(32).toString("hex");
    const response = NextResponse.redirect(buildAuthUrl(state));
    response.cookies.set("threads_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "OAuth init failed" }, { status: 500 });
  }
}
