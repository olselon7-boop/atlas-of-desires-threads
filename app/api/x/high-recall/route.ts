import { NextRequest, NextResponse } from "next/server";
import { detectDesire } from "@/lib/desire";
import { enrichDesireText } from "@/lib/desire-enrichment";
import { buildXSearchUrl, estimateXPostReadCost, X_HIGH_RECALL_QUERIES } from "@/lib/x";

type XPost = {
  id?: string;
  text?: string;
  author_id?: string;
  created_at?: string;
  lang?: string;
  attachments?: { media_keys?: string[] };
  geo?: { place_id?: string };
};

type XResponse = {
  data?: XPost[];
  title?: string;
  detail?: string;
};

async function runQuery(token: string, query: string, year: number) {
  const start = `${year}-01-01T00:00:00Z`;
  const hardEnd = new Date(`${year}-12-31T23:59:59Z`).getTime();
  const safeEnd = new Date(Math.min(hardEnd, Date.now() - 60_000)).toISOString();
  const url = buildXSearchUrl({ mode: "all", query, maxResults: 10, startTime: start, endTime: safeEnd });
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "AtlasOfDesires/0.7 high-recall-research",
    },
    cache: "no-store",
  });
  const body = await response.json().catch(() => null) as XResponse | null;
  if (!response.ok) throw new Error(body?.detail || body?.title || `X API error ${response.status}`);
  return body?.data || [];
}

function noiseHint(text: string) {
  const lower = text.toLowerCase();
  if (/\b(?:dreamt|dreamed|dreaming) last night\b|\b(?:in|from) my dream\b|сон приснил|мне приснил/iu.test(text)) return "sleep_dream";
  if (/\blyrics?\b|\bquote\b|цитат|стих|песня/iu.test(text)) return "quote_or_lyrics";
  if (/^rt\s*@/iu.test(text)) return "legacy_retweet";
  if (/\b(?:his|her|their) dream\b|его мечт|ее мечт|её мечт|их мечт/iu.test(text)) return "third_person";
  if (lower.includes("dream") || /мечт/iu.test(text)) return "candidate";
  return "other";
}

export async function GET(request: NextRequest) {
  const token = process.env.X_BEARER_TOKEN;
  if (!token) return NextResponse.json({ error: "X_BEARER_TOKEN is not configured." }, { status: 503 });

  const params = new URL(request.url).searchParams;
  const execute = params.get("execute") === "1";
  const year = Number(params.get("year") || "2026");
  if (!Number.isInteger(year) || year < 2006 || year > new Date().getUTCFullYear()) {
    return NextResponse.json({ error: "Invalid year." }, { status: 400 });
  }

  const languageParam = params.get("language");
  const languages = languageParam === "ru" || languageParam === "en"
    ? [languageParam] as const
    : ["ru", "en"] as const;

  const allCells = languages.flatMap(language =>
    X_HIGH_RECALL_QUERIES[language].map(query => ({ language, query }))
  );
  const batchParam = params.get("batch");
  const batchSize = 5;
  const batch = batchParam == null ? null : Number(batchParam);
  if (batch != null && (!Number.isInteger(batch) || batch < 0)) {
    return NextResponse.json({ error: "Invalid batch." }, { status: 400 });
  }
  const cells = batch == null
    ? allCells
    : allCells.slice(batch * batchSize, batch * batchSize + batchSize);

  if (!execute) {
    const maxPosts = cells.length * 10;
    return NextResponse.json({
      mode: "dry-run",
      year,
      languages,
      queryCount: cells.length,
      totalQueryCount: allCells.length,
      batch,
      batchSize,
      maxPosts,
      estimatedMaxReadCostUsd: estimateXPostReadCost(maxPosts),
      queries: cells,
      note: "High-recall pilot. Use batch=0,1,2... with execute=1; each batch runs at most 5 queries to avoid serverless timeouts.",
    }, { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
  }

  const rows: Array<{
    id: string;
    language: "ru" | "en";
    query: string;
    text: string;
    createdAt: string | null;
    detectedState: string;
    noiseHint: string;
    hasMedia: boolean;
    hasPlace: boolean;
    enrichment: ReturnType<typeof enrichDesireText>;
  }> = [];
  const perQuery: Array<{
    language: "ru" | "en";
    query: string;
    count: number;
    uniqueCount: number;
  }> = [];

  for (const cell of cells) {
    const posts = await runQuery(token, cell.query, year);
    const seen = new Set<string>();
    for (const post of posts) {
      if (!post.id || !post.text) continue;
      seen.add(post.id);
      const interpretation = detectDesire(post.text);
      rows.push({
        id: post.id,
        language: cell.language,
        query: cell.query,
        text: post.text,
        createdAt: post.created_at || null,
        detectedState: interpretation.dream_state,
        noiseHint: noiseHint(post.text),
        hasMedia: Boolean(post.attachments?.media_keys?.length),
        hasPlace: Boolean(post.geo?.place_id),
        enrichment: enrichDesireText(post.text),
      });
    }
    perQuery.push({ language: cell.language, query: cell.query, count: posts.length, uniqueCount: seen.size });
  }

  const dedup = new Map<string, typeof rows[number]>();
  for (const row of rows) if (!dedup.has(row.id)) dedup.set(row.id, row);
  const unique = [...dedup.values()];

  const byLanguage: Record<string, number> = {};
  const byState: Record<string, number> = {};
  const byNoiseHint: Record<string, number> = {};
  const byExpressionType: Record<string, number> = {};
  const byDeepDesire: Record<string, number> = {};
  let humanAspirations = 0;
  let withMedia = 0;
  let withPlace = 0;

  for (const row of unique) {
    byLanguage[row.language] = (byLanguage[row.language] || 0) + 1;
    byState[row.detectedState] = (byState[row.detectedState] || 0) + 1;
    byNoiseHint[row.noiseHint] = (byNoiseHint[row.noiseHint] || 0) + 1;
    byExpressionType[row.enrichment.expression_type] = (byExpressionType[row.enrichment.expression_type] || 0) + 1;
    byDeepDesire[row.enrichment.deep_desire] = (byDeepDesire[row.enrichment.deep_desire] || 0) + 1;
    if (row.enrichment.is_human_aspiration) humanAspirations++;
    if (row.hasMedia) withMedia++;
    if (row.hasPlace) withPlace++;
  }

  return NextResponse.json({
    mode: "high-recall-pilot",
    year,
    totalFetched: rows.length,
    uniquePosts: unique.length,
    estimatedReadCostUsd: estimateXPostReadCost(rows.length),
    duplicateRate: rows.length ? Number(((rows.length - unique.length) / rows.length).toFixed(3)) : 0,
    byLanguage,
    byState,
    byNoiseHint,
    humanAspirations,
    humanAspirationRate: unique.length ? Number((humanAspirations / unique.length).toFixed(3)) : 0,
    byExpressionType,
    byDeepDesire,
    withMedia,
    withPlace,
    perQuery,
    sample: unique.slice(0, 100).map(row => ({
      language: row.language,
      query: row.query,
      createdAt: row.createdAt,
      detectedState: row.detectedState,
      noiseHint: row.noiseHint,
      text: row.text,
      hasMedia: row.hasMedia,
      hasPlace: row.hasPlace,
      enrichment: row.enrichment,
    })),
    warning: "High-recall exploration only. noiseHint is heuristic and not a validated aspiration classifier.",
  }, { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}
