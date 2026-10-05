import crypto from "node:crypto";
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
    verifySignedRequest(signedRequest, secret);
    const confirmationCode = crypto.randomUUID();
    const base = process.env.NEXT_PUBLIC_BASE_URL || new URL(request.url).origin;

    return NextResponse.json({
      url: `${base}/data-deletion?code=${encodeURIComponent(confirmationCode)}`,
      confirmation_code: confirmationCode
    });
  } catch {
    return NextResponse.json({ error: "Invalid signed_request" }, { status: 400 });
  }
}
