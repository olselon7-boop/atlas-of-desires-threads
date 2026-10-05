import crypto from "node:crypto";

function base64UrlToBuffer(value: string) {
  const pad = value.length % 4 ? "=".repeat(4 - (value.length % 4)) : "";
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

export function verifySignedRequest(signedRequest: string, secret: string) {
  const [sigPart, payloadPart] = signedRequest.split(".");
  if (!sigPart || !payloadPart) throw new Error("Invalid signed_request");

  const expected = crypto.createHmac("sha256", secret).update(payloadPart).digest();
  const actual = base64UrlToBuffer(sigPart);
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    throw new Error("Invalid signed_request signature");
  }

  const payload = JSON.parse(base64UrlToBuffer(payloadPart).toString("utf8")) as Record<string, unknown>;
  const algorithm = String(payload.algorithm || "HMAC-SHA256").toUpperCase();
  if (algorithm !== "HMAC-SHA256") throw new Error("Unsupported signed_request algorithm");
  return payload;
}
