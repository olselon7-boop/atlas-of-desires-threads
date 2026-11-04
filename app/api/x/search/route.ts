import { NextRequest, NextResponse } from "next/server";
import { buildXSearchUrl, estimateXPostReadCost, type XSearchMode } from "@/lib/x";

const MAX_RESULTS = 10;

export async function GET(request: NextRequest) {
  const token = process.env.X_BEARER_TOKEN;
  if (!token) {
    return NextResponse.json({
      error: "X_BEARER_TOKEN is not configured.",
      configured: false,
    }, { status: 503 });
  }

  const params = new URL(request.url).searchParams;
  const query = (params.get("q") || '"я мечтаю" lang:ru -is:retweet').slice(0, 512);
  const requestedMode = params.get("mode");
  const mode: XSearchMode = requestedMode === "all" ? "all" : "recent";
  const nextToken = params.get("next_token");
  const startTime = params.get("start_time");
  const endTime = params.get("end_time");

  const url = buildXSearchUrl({
    mode,
    query,
    maxResults: MAX_RESULTS,
    nextToken,
    startTime,
    endTime,
  });

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "AtlasOfDesires/0.4 research-art",
    },
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null) as {
    data?: Array<Record<string, unknown>>;
    includes?: Record<string, unknown>;
    meta?: Record<string, unknown> & { next_token?: string; result_count?: number };
    errors?: unknown[];
    title?: string;
    detail?: string;
  } | null;

  if (!response.ok) {
    return NextResponse.json({
      source: "x",
      mode,
      upstreamStatus: response.status,
      error: payload?.detail || payload?.title || "X API request failed.",
      errors: payload?.errors || null,
    }, { status: 502 });
  }

  const posts = Array.isArray(payload?.data) ? payload!.data! : [];
  return NextResponse.json({
    source: "x",
    mode,
    query,
    resultCount: posts.length,
    estimatedReadCostUsd: estimateXPostReadCost(posts.length),
    meta: payload?.meta || null,
    posts,
    includes: payload?.includes || null,
    warning: "Research-only smoke endpoint. max_results is intentionally capped at 10 to control X API costs.",
  }, { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}
