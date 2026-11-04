import { NextRequest, NextResponse } from "next/server";
import { detectDesire } from "@/lib/desire";
import { buildXSearchUrl, estimateXPostReadCost, X_ANCHOR_YEARS, X_LIFECYCLE_QUERIES } from "@/lib/x";

type XPost = {
  id?: string;
  text?: string;
  author_id?: string;
  created_at?: string;
  lang?: string;
  conversation_id?: string;
  attachments?: { media_keys?: string[] };
  geo?: { place_id?: string };
};

type XResponse = {
  data?: XPost[];
  meta?: { result_count?: number };
  title?: string;
  detail?: string;
};

const STATES = ["dreaming", "fulfilled_passive", "fulfilled_active"] as const;

async function searchCell(token: string, query: string, year: number) {
  const start = `${year}-01-01T00:00:00Z`;
  const hardEnd = new Date(`${year}-12-31T23:59:59Z`).getTime();
  const safeEnd = new Date(Math.min(hardEnd, Date.now() - 60_000)).toISOString();
  const url = buildXSearchUrl({ mode: "all", query, maxResults: 10, startTime: start, endTime: safeEnd });
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "AtlasOfDesires/0.6 anchor-year-research",
    },
    cache: "no-store",
  });
  const body = await response.json().catch(() => null) as XResponse | null;
  if (!response.ok) throw new Error(body?.detail || body?.title || `X API error ${response.status}`);
  return body?.data || [];
}

export async function GET(request: NextRequest) {
  const token = process.env.X_BEARER_TOKEN;
  if (!token) return NextResponse.json({ error: "X_BEARER_TOKEN is not configured." }, { status: 503 });

  const params = new URL(request.url).searchParams;
  const execute = params.get("execute") === "1";
  const yearParam = params.get("year");
  const selectedYears = yearParam
    ? X_ANCHOR_YEARS.filter(y => String(y) === yearParam)
    : X_ANCHOR_YEARS;

  if (yearParam && selectedYears.length === 0) {
    return NextResponse.json({ error: "Unknown anchor year.", allowedYears: X_ANCHOR_YEARS }, { status: 400 });
  }

  const cells = selectedYears.flatMap(year =>
    (["ru", "en"] as const).flatMap(language =>
      STATES.map(state => ({
        year,
        language,
        state,
        query: X_LIFECYCLE_QUERIES[language][state],
      }))
    )
  );

  if (!execute) {
    const maxPosts = cells.length * 10;
    return NextResponse.json({
      mode: "dry-run",
      years: selectedYears,
      states: STATES,
      languages: ["ru", "en"],
      cells: cells.length,
      maxPosts,
      estimatedMaxReadCostUsd: estimateXPostReadCost(maxPosts),
      note: "Run per year with ?execute=1&year=YYYY to avoid serverless timeouts. Each cell is capped at 10 posts.",
    }, { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
  }

  const rows: Array<{
    year: number;
    language: "ru" | "en";
    intendedState: typeof STATES[number];
    detectedState: string;
    createdAt: string | null;
    text: string;
    hasMedia: boolean;
    hasPlace: boolean;
    authorId: string | null;
    id: string;
  }> = [];
  const perCell: Array<{ year: number; language: string; intendedState: string; count: number }> = [];

  for (const cell of cells) {
    const posts = await searchCell(token, cell.query, cell.year);
    perCell.push({ year: cell.year, language: cell.language, intendedState: cell.state, count: posts.length });
    for (const post of posts) {
      if (!post.id || !post.text) continue;
      const interpretation = detectDesire(post.text);
      rows.push({
        year: cell.year,
        language: cell.language,
        intendedState: cell.state,
        detectedState: interpretation.dream_state,
        createdAt: post.created_at || null,
        text: post.text,
        hasMedia: Boolean(post.attachments?.media_keys?.length),
        hasPlace: Boolean(post.geo?.place_id),
        authorId: post.author_id || null,
        id: post.id,
      });
    }
  }

  const dedup = new Map<string, typeof rows[number]>();
  for (const row of rows) if (!dedup.has(row.id)) dedup.set(row.id, row);
  const unique = [...dedup.values()];

  const byYear: Record<string, number> = {};
  const byLanguage: Record<string, number> = {};
  const byIntendedState: Record<string, number> = {};
  const byDetectedState: Record<string, number> = {};
  let withMedia = 0;
  let withPlace = 0;

  for (const row of unique) {
    byYear[row.year] = (byYear[row.year] || 0) + 1;
    byLanguage[row.language] = (byLanguage[row.language] || 0) + 1;
    byIntendedState[row.intendedState] = (byIntendedState[row.intendedState] || 0) + 1;
    byDetectedState[row.detectedState] = (byDetectedState[row.detectedState] || 0) + 1;
    if (row.hasMedia) withMedia++;
    if (row.hasPlace) withPlace++;
  }

  return NextResponse.json({
    mode: "anchor-year-pilot",
    generatedAt: new Date().toISOString(),
    selectedYears,
    totalFetched: rows.length,
    uniquePosts: unique.length,
    estimatedReadCostUsd: estimateXPostReadCost(rows.length),
    perCell,
    byYear,
    byLanguage,
    byIntendedState,
    byDetectedState,
    withMedia,
    withPlace,
    sample: unique.slice(0, 80).map(row => ({
      year: row.year,
      language: row.language,
      intendedState: row.intendedState,
      detectedState: row.detectedState,
      createdAt: row.createdAt,
      text: row.text,
      hasMedia: row.hasMedia,
      hasPlace: row.hasPlace,
    })),
    warning: "Anchor-year pilot. Search is still sorted latest within each year, so samples are biased toward the end of each year. Use for cross-sectional exploration, not population estimates.",
  }, { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}
