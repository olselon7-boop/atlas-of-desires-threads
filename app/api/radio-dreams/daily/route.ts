import { NextResponse } from "next/server";
import postgres from "postgres";
import { buildXSearchUrl } from "@/lib/x";
import { enrichDesireText, type DeepDesire } from "@/lib/desire-enrichment";
import { persistXSearchResponse, type XPersistResponse } from "@/lib/x-persistence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type XPost = {
  id: string;
  text: string;
  created_at?: string;
  lang?: string;
  author_id?: string;
  conversation_id?: string;
  attachments?: { media_keys?: string[] };
  geo?: { place_id?: string };
  referenced_tweets?: Array<{ type?: string; id?: string }>;
};

type XResponse = XPersistResponse & {
  data?: XPost[];
  meta?: {
    newest_id?: string;
    oldest_id?: string;
    result_count?: number;
    next_token?: string;
  };
  title?: string;
  detail?: string;
};

const QUERIES = [
  '("я мечтаю" OR "всегда мечтал" OR "всегда мечтала" OR "давно мечтаю" OR "мечта детства" OR "мечта всей жизни" OR "мечтаю стать" OR "мечтаю жить" OR "мечтаю поехать" OR "мечтаю переехать" OR "мечта сбылась" OR "мечта исполнилась" OR "исполнил мечту" OR "исполнила мечту" OR "осуществил мечту" OR "осуществила мечту" OR "реализовал мечту" OR "реализовала мечту") lang:ru -is:retweet',
  '("I dream of" OR "I dream about" OR "always dreamed of" OR "lifelong dream" OR "dream of becoming" OR "dream of living" OR "dream of moving" OR "dream of traveling" OR "my dream came true" OR "I achieved my dream" OR "I made my dream come true") lang:en -is:retweet'
] as const;

function partsInZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: string) => Number(parts.find(p => p.type === type)?.value || 0);
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
    second: value("second"),
  };
}

function zonedLocalToUtc(
  year: number, month: number, day: number, hour: number, minute: number, second: number,
  timeZone: string
) {
  let guess = Date.UTC(year, month - 1, day, hour, minute, second);
  for (let i = 0; i < 3; i++) {
    const actual = partsInZone(new Date(guess), timeZone);
    const actualAsUtc = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
    const desiredAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
    guess += desiredAsUtc - actualAsUtc;
  }
  return new Date(guess);
}

function previousCompletedDay(timeZone = "Europe/London") {
  const nowParts = partsInZone(new Date(), timeZone);
  const localTodayAsUtc = new Date(Date.UTC(nowParts.year, nowParts.month - 1, nowParts.day));
  localTodayAsUtc.setUTCDate(localTodayAsUtc.getUTCDate() - 1);

  const year = localTodayAsUtc.getUTCFullYear();
  const month = localTodayAsUtc.getUTCMonth() + 1;
  const day = localTodayAsUtc.getUTCDate();

  const start = zonedLocalToUtc(year, month, day, 0, 0, 0, timeZone);
  const nextLocal = new Date(Date.UTC(year, month - 1, day));
  nextLocal.setUTCDate(nextLocal.getUTCDate() + 1);
  const end = zonedLocalToUtc(
    nextLocal.getUTCFullYear(),
    nextLocal.getUTCMonth() + 1,
    nextLocal.getUTCDate(),
    0, 0, 0,
    timeZone
  );

  const date = `${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
  return { date, start, end, timeZone };
}

async function fetchAll(token: string, query: string, start: Date, end: Date) {
  const pages: XResponse[] = [];
  let nextToken: string | null = null;
  let guard = 0;

  do {
    const url = buildXSearchUrl({
      mode: "recent",
      query,
      maxResults: 100,
      nextToken,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
    });

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "User-Agent": "AtlasOfDesires/1.1 radio-dreams-daily",
      },
      cache: "no-store",
    });

    const body = (await response.json().catch(() => ({}))) as XResponse;
    if (!response.ok) throw new Error(body.detail || body.title || `X API error ${response.status}`);

    pages.push(body);
    nextToken = body.meta?.next_token || null;
    guard++;
  } while (nextToken && guard < 100);

  return pages;
}

function mergePages(pages: XResponse[]) {
  const data: XPost[] = [];
  const media: NonNullable<NonNullable<XResponse["includes"]>["media"]> = [];
  const users: NonNullable<NonNullable<XResponse["includes"]>["users"]> = [];
  const places: NonNullable<NonNullable<XResponse["includes"]>["places"]> = [];
  const seenPosts = new Set<string>();
  const seenMedia = new Set<string>();

  for (const page of pages) {
    for (const post of page.data || []) {
      if (!post.id || seenPosts.has(post.id)) continue;
      seenPosts.add(post.id);
      data.push(post);
    }
    for (const item of page.includes?.media || []) {
      const key = item.media_key || JSON.stringify(item);
      if (seenMedia.has(key)) continue;
      seenMedia.add(key);
      media.push(item);
    }
    users.push(...(page.includes?.users || []));
    places.push(...(page.includes?.places || []));
  }

  return { data, includes: { media, users, places } } as XResponse;
}

async function readDailyFromDb(db: postgres.Sql, start: Date, end: Date) {
  return db.unsafe(`
    select
      d.id,
      rp.source_post_id as source_id,
      d.surface_expression as text,
      rp.source_created_at as created_at,
      d.language,
      d.deep_desire as cluster,
      d.dream_state as state,
      d.agency,
      d.confidence,
      coalesce(
        json_agg(
          json_build_object(
            'type', ma.media_type,
            'url', ma.source_url,
            'preview_url', ma.preview_url,
            'width', ma.width,
            'height', ma.height,
            'alt_text', ma.alt_text
          )
        ) filter (where ma.id is not null),
        '[]'::json
      ) as media
    from desires d
    join raw_posts rp on rp.id=d.primary_post_id
    left join media_assets ma on ma.post_id=rp.id
    where rp.platform='x'
      and rp.source_created_at >= $1
      and rp.source_created_at < $2
      and d.is_human_aspiration=true
    group by d.id, rp.source_post_id, rp.source_created_at, d.language, d.deep_desire,
             d.dream_state, d.agency, d.confidence
    order by rp.source_created_at asc
  `, [start.toISOString(), end.toISOString()]);
}

export async function GET() {
  const token = process.env.X_BEARER_TOKEN;
  const dbUrl = process.env.POSTGRES_URL;
  if (!token || !dbUrl) return NextResponse.json({ error: "X or database is not configured" }, { status: 503 });

  const day = previousCompletedDay("Europe/London");
  const db = postgres(dbUrl, { max: 1, ssl: "require" });

  try {
    const marker = await db.unsafe(`
      select id from collection_runs
      where platform='x'
        and query='radio-dreams-daily'
        and start_time=$1
        and end_time=$2
        and status='completed'
      limit 1
    `, [day.start.toISOString(), day.end.toISOString()]);

    if (!marker.length) {
      const [ruPages, enPages] = await Promise.all([
        fetchAll(token, QUERIES[0], day.start, day.end),
        fetchAll(token, QUERIES[1], day.start, day.end),
      ]);

      for (const [query, pages] of [[QUERIES[0], ruPages], [QUERIES[1], enPages]] as const) {
        for (const page of pages) {
          if (!page.data?.length) continue;
          await persistXSearchResponse({
            response: page,
            query,
            year: day.start.getUTCFullYear(),
            estimatedCostUsd: 0,
          });
        }
      }

      await db.unsafe(`
        insert into collection_runs (
          platform, query, start_time, end_time, posts_requested, posts_received,
          posts_new, posts_duplicate, estimated_cost_usd, status, finished_at, metadata
        )
        values (
          'x','radio-dreams-daily',$1,$2,0,0,0,0,0,'completed',now(),
          $3::jsonb
        )
      `, [
        day.start.toISOString(),
        day.end.toISOString(),
        JSON.stringify({
          mode: "radio-daily",
          date: day.date,
          timezone: day.timeZone,
          ru_pages: ruPages.length,
          en_pages: enPages.length,
        })
      ]);
    }

    const rows = await readDailyFromDb(db, day.start, day.end);

    const posts = rows.map((row: any) => ({
      id: row.source_id,
      text: row.text,
      created_at: row.created_at,
      language: row.language,
      cluster: row.cluster as DeepDesire,
      state: row.state,
      agency: row.agency,
      confidence: Number(row.confidence || 0),
      permalink: `https://x.com/i/web/status/${row.source_id}`,
      media: row.media || [],
    }));

    const clusterCounts: Record<string, number> = {};
    for (const post of posts) clusterCounts[post.cluster] = (clusterCounts[post.cluster] || 0) + 1;

    return NextResponse.json({
      source: "x_recent_daily",
      date: day.date,
      timezone: day.timeZone,
      start: day.start.toISOString(),
      end: day.end.toISOString(),
      total: posts.length,
      posts,
      cluster_counts: clusterCounts,
    }, {
      headers: {
        "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
        "X-Robots-Tag": "noindex"
      }
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Unknown daily collection error"
    }, { status: 502 });
  } finally {
    await db.end({ timeout: 2 });
  }
}
