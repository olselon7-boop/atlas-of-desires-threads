import { NextResponse } from "next/server";

export async function GET() {
  const configured = Boolean(process.env.X_BEARER_TOKEN);
  return NextResponse.json({
    source: "x",
    configured,
    bearerToken: configured ? "configured" : "missing",
    recentSearch: "/2/tweets/search/recent",
    fullArchiveSearch: "/2/tweets/search/all",
    note: "No X credentials are ever returned by this endpoint.",
  }, { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}
