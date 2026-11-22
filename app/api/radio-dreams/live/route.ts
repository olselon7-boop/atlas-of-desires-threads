import { NextRequest, NextResponse } from "next/server";
import { buildXSearchUrl } from "@/lib/x";
import { enrichDesireText, type DeepDesire } from "@/lib/desire-enrichment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type XPost = {
  id: string;
  text: string;
  created_at?: string;
  lang?: string;
  attachments?: { media_keys?: string[] };
  referenced_tweets?: Array<{ type?: string; id?: string }>;
};

type XResponse = {
  data?: XPost[];
  includes?: {
    tweets?: XPost[];
    media?: Array<{
      media_key?: string;
      type?: string;
      url?: string;
      preview_image_url?: string;
      width?: number;
      height?: number;
      alt_text?: string;
      duration_ms?: number;
      variants?: Array<{ bit_rate?: number; content_type?: string; url?: string }>;
    }>;
  };
  meta?: { newest_id?: string; oldest_id?: string; result_count?: number };
  title?: string;
  detail?: string;
};

const QUERIES = [
  {
    language: "ru",
    query:
      '("я мечтаю" OR "всегда мечтал" OR "всегда мечтала" OR "давно мечтаю" OR "мечта детства" OR "мечта всей жизни" OR "мечтаю стать" OR "мечтаю жить" OR "мечтаю поехать" OR "мечтаю переехать" OR "мечта сбылась" OR "мечта исполнилась" OR "исполнил мечту" OR "исполнила мечту" OR "осуществил мечту" OR "осуществила мечту" OR "реализовал мечту" OR "реализовала мечту") lang:ru -is:retweet'
  },
  {
    language: "en",
    query:
      '("I dream of" OR "I dream about" OR "always dreamed of" OR "lifelong dream" OR "dream of becoming" OR "dream of living" OR "dream of moving" OR "dream of traveling" OR "my dream came true" OR "I achieved my dream" OR "I made my dream come true") lang:en -is:retweet'
  }
] as const;

function startOfTodayAmsterdamIso() {
  const now = new Date();
  const dateParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const year = Number(dateParts.find(p=>p.type==="year")?.value || now.getUTCFullYear());
  const month = Number(dateParts.find(p=>p.type==="month")?.value || now.getUTCMonth()+1);
  const day = Number(dateParts.find(p=>p.type==="day")?.value || now.getUTCDate());

  const offsetName = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Amsterdam",
    timeZoneName: "shortOffset",
    hour: "2-digit"
  }).formatToParts(new Date(Date.UTC(year,month-1,day,12)))
    .find(p=>p.type==="timeZoneName")?.value || "GMT+1";
  const match = offsetName.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  const sign = match?.[1] === "-" ? -1 : 1;
  const hours = Number(match?.[2] || 0);
  const minutes = Number(match?.[3] || 0);
  const offsetMs = sign * (hours*60 + minutes) * 60_000;

  return new Date(Date.UTC(year,month-1,day,0,0,0) - offsetMs).toISOString();
}

async function search(token: string, query: string, sinceId?: string | null) {
  const url = buildXSearchUrl({ mode: "recent", query, maxResults: sinceId ? 10 : 100 });
  if (sinceId) {
    url.searchParams.set("since_id", sinceId);
  } else {
    url.searchParams.set("start_time", startOfTodayAmsterdamIso());
  }
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "User-Agent": "AtlasOfDesires/1.0 radio-dreams"
    },
    cache: "no-store"
  });
  const body = (await response.json().catch(() => ({}))) as XResponse;
  if (!response.ok) throw new Error(body.detail || body.title || `X API error ${response.status}`);
  return body;
}

export async function GET(req: NextRequest) {
  const token = process.env.X_BEARER_TOKEN;
  if (!token) return NextResponse.json({ error: "X is not configured" }, { status: 503 });

  const params = new URL(req.url).searchParams;
  const sinceRu = params.get("since_ru");
  const sinceEn = params.get("since_en");

  try {
    const [ru, en] = await Promise.all([
      search(token, QUERIES[0].query, sinceRu),
      search(token, QUERIES[1].query, sinceEn)
    ]);

    const mediaByKey = new Map(
      [...(ru.includes?.media || []), ...(en.includes?.media || [])]
        .filter(m => m.media_key)
        .map(m => [m.media_key as string, m])
    );

    const referencedById = new Map(
      [...(ru.includes?.tweets || []), ...(en.includes?.tweets || [])]
        .map(t => [t.id, t] as const)
    );

    const merged = [
      ...(ru.data || []).map(p => ({ ...p, source_language: "ru" })),
      ...(en.data || []).map(p => ({ ...p, source_language: "en" }))
    ];

    const posts = merged
      .map(post => {
        const e = enrichDesireText(post.text);
        return {
          id: post.id,
          text: post.text,
          created_at: post.created_at || null,
          language: post.lang || post.source_language,
          cluster: e.deep_desire as DeepDesire,
          state: e.lifecycle_state,
          agency: e.agency,
          confidence: e.confidence,
          is_human_aspiration: e.is_human_aspiration,
          permalink: `https://x.com/i/web/status/${post.id}`,
          media: (() => {
            const ownKeys = post.attachments?.media_keys || [];
            const referencedKeys = (post.referenced_tweets || [])
              .flatMap(ref => referencedById.get(ref.id || "")?.attachments?.media_keys || []);
            const keys = ownKeys.length ? ownKeys : referencedKeys;

            return keys
              .map(key => mediaByKey.get(key))
              .filter(Boolean)
              .map(m => ({
                type: m?.type || null,
                url: m?.url || m?.preview_image_url || null,
                preview_url: m?.preview_image_url || null,
                width: m?.width || null,
                height: m?.height || null,
                alt_text: m?.alt_text || null,
              duration_ms: m?.duration_ms || null,
              video_url: (m?.variants || [])
                .filter(v => v.content_type === "video/mp4" && v.url)
                .sort((a,b)=>(b.bit_rate||0)-(a.bit_rate||0))[0]?.url || null
              }))
              .filter(m => m.url);
          })()
        };
      })
      .filter(p => p.is_human_aspiration)
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));

    const clusterCounts: Record<string, number> = {};
    for (const post of posts) clusterCounts[post.cluster] = (clusterCounts[post.cluster] || 0) + 1;

    return NextResponse.json({
      source: "x_recent",
      fetched_at: new Date().toISOString(),
      posts,
      cluster_counts: clusterCounts,
      cursors: {
        ru: ru.meta?.newest_id || sinceRu || null,
        en: en.meta?.newest_id || sinceEn || null
      }
    }, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "X-Robots-Tag": "noindex"
      }
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Unknown X error"
    }, { status: 502 });
  }
}
