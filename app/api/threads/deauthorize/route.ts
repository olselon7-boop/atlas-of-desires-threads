import { NextRequest, NextResponse } from "next/server";
import { verifySignedRequest } from "@/lib/meta-signed-request";

export async function POST(request: NextRequest) {
  const secret = process.env.THREADS_APP_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  const form = await request.formData();
  const signedRequest = form.get("signed_request");

  if (typeof signedRequest !== "string") {
    return NextResponse.json({ error: "Missing signed_request" }, { status: 400 });
  }

  try {
    const payload = verifySignedRequest(signedRequest, secret);
    const response = NextResponse.json({ success: true, user_id: payload.user_id ?? null });
    response.cookies.delete("threads_access_token");
    return response;
  } catch {
    return NextResponse.json({ error: "Invalid signed_request" }, { status: 400 });
  }
}
