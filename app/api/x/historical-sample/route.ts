import { NextRequest, NextResponse } from "next/server";
import { detectDesire } from "@/lib/desire";
import { buildXSearchUrl, estimateXPostReadCost, X_HISTORICAL_FORMULAS, X_HISTORICAL_PERIODS } from "@/lib/x";

type XPost = {
  id?: string;
  text?: string;
  author_id?: string;
  created_at?: string;
  lang?: string;
  conversation_id?: string;
  attachments?: { media_keys?: string[] };
  geo?: { place_id?: string };
  referenced_tweets?: Array<{ id?: string; type?: string }>;
};

type XResponse = {
  data?: XPost[];
  meta?: { result_count?: number; next_token?: string };
  includes?: {
    media?: Array<Record<string, unknown> & { media_key?: string; type?: string; url?: string; preview_image_url?: string }>;
    places?: Array<Record<string, unknown> & { id?: string; full_name?: string; country?: string; country_code?: string }>;
  };
  title?: string;
  detail?: string;
};

async function searchOne(query: string, start: string, end: string, token: string) {
  const url = buildXSearchUrl({ mode: "all", query, maxResults: 10, startTime: start, endTime: end });
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "AtlasOfDesires/0.5 historical-research",
    },
    cache: "no-store",
  });
  const body = await response.json().catch(() => null) as XResponse | null;
  if (!response.ok) {
    throw new Error(body?.detail || body?.title || `X API error ${response.status}`);
  }
  return body || {};
}

export async function GET(request: NextRequest) {
  const token = process.env.X_BEARER_TOKEN;
  if (!token) return NextResponse.json({ error: "X_BEARER_TOKEN is not configured." }, { status: 503 });

  const params = new URL(request.url).searchParams;
  const execute = params.get("execute") === "1";
  const periodFilter = params.get("period");
  const selectedPeriods = periodFilter
    ? X_HISTORICAL_PERIODS.filter(period => period.id === periodFilter)
    : X_HISTORICAL_PERIODS;

  if (periodFilter && selectedPeriods.length === 0) {
    return NextResponse.json({ error: "Unknown period.", allowedPeriods: X_HISTORICAL_PERIODS.map(p => p.id) }, { status: 400 });
  }

  const cells = selectedPeriods.flatMap(period =>
    (["ru", "en"] as const).flatMap(language =>
      X_HISTORICAL_FORMULAS[language].map(query => ({
        period: period.id,
        start: period.start,
        end: period.end,
        language,
        query,
      }))
    )
  );

  if (!execute) {
    const maxPosts = cells.length * 10;
    return NextResponse.json({
      mode: "dry-run",
      cells: cells.length,
      maxPosts,
      estimatedMaxReadCostUsd: estimateXPostReadCost(maxPosts),
      periods: selectedPeriods,
      formulas: X_HISTORICAL_FORMULAS,
      note: "Add ?execute=1 to run the pilot. Each stratum is capped at 10 posts.",
    }, { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
  }

  const rows: Array<{
    period: string;
    language: "ru" | "en";
    query: string;
    id: string;
    createdAt: string | null;
    text: string;
    authorId: string | null;
    conversationId: string | null;
    state: string;
    agency: string;
    modality: string | null;
    durationMentioned: string | null;
    hasMedia: boolean;
    placeId: string | null;
  }> = [];
  const perCell: Array<{ period: string; language: string; query: string; count: number }> = [];

  for (const cell of cells) {
    const safeEnd = new Date(Math.min(new Date(cell.end).getTime(), Date.now() - 60_000)).toISOString();
    const body = await searchOne(cell.query, cell.start, safeEnd, token);
    const posts = body.data || [];
    perCell.push({ period: cell.period, language: cell.language, query: cell.query, count: posts.length });
    for (const post of posts) {
      if (!post.id || !post.text) continue;
      const interpretation = detectDesire(post.text);
      rows.push({
        period: cell.period,
        language: cell.language,
        query: cell.query,
        id: post.id,
        createdAt: post.created_at || null,
        text: post.text,
        authorId: post.author_id || null,
        conversationId: post.conversation_id || null,
        state: interpretation.dream_state,
        agency: interpretation.agency,
        modality: interpretation.modality,
        durationMentioned: interpretation.duration_mentioned,
        hasMedia: Boolean(post.attachments?.media_keys?.length),
        placeId: post.geo?.place_id || null,
      });
    }
  }

  const dedup = new Map<string, typeof rows[number]>();
  for (const row of rows) if (!dedup.has(row.id)) dedup.set(row.id, row);
  const unique = [...dedup.values()];

  const byPeriod: Record<string, number> = {};
  const byLanguage: Record<string, number> = {};
  const byState: Record<string, number> = {};
  let withMedia = 0;
  let withPlace = 0;

  for (const row of unique) {
    byPeriod[row.period] = (byPeriod[row.period] || 0) + 1;
    byLanguage[row.language] = (byLanguage[row.language] || 0) + 1;
    byState[row.state] = (byState[row.state] || 0) + 1;
    if (row.hasMedia) withMedia += 1;
    if (row.placeId) withPlace += 1;
  }

  return NextResponse.json({
    mode: "pilot",
    generatedAt: new Date().toISOString(),
    strata: cells.length,
    totalFetched: rows.length,
    uniquePosts: unique.length,
    estimatedReadCostUsd: estimateXPostReadCost(rows.length),
    perCell,
    byPeriod,
    byLanguage,
    byState,
    withMedia,
    withPlace,
    sample: unique.slice(0, 60).map(row => ({
      period: row.period,
      language: row.language,
      createdAt: row.createdAt,
      state: row.state,
      text: row.text,
      hasMedia: row.hasMedia,
      hasPlace: Boolean(row.placeId),
    })),
    warning: "Pilot cross-section only. Search is sorted latest, so each multi-year stratum is dominated by the latest matching dates in that window. Treat results as anchor-year samples, not representative of the full period. Raw author identifiers are intentionally omitted from the response sample.",
  }, { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}
