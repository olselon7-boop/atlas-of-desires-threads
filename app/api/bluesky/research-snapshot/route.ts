import { NextRequest, NextResponse } from "next/server";
import { detectDesire } from "@/lib/desire";

const DEFAULT_QUERIES = [
  "я мечтаю",
  "все еще мечтаю",
  "до сих пор мечтаю",
  "мечта сбылась",
  "мечта исполнилась",
  "исполнил мечту",
  "осуществил мечту",
  "I dream",
  "still dreaming",
  "my dream came true",
  "I made my dream come true",
];

type SearchPost = {
  uri?: string;
  author?: { did?: string };
  record?: { text?: string; createdAt?: string };
};

async function createSession() {
  const identifier = process.env.BSKY_IDENTIFIER;
  const password = process.env.BSKY_APP_PASSWORD;
  if (!identifier || !password) throw new Error("Bluesky credentials are not configured.");
  const response = await fetch("https://bsky.social/xrpc/com.atproto.server.createSession", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ identifier, password }),
    cache: "no-store",
  });
  const json = await response.json().catch(() => null) as { accessJwt?: string } | null;
  if (!response.ok || !json?.accessJwt) throw new Error("Bluesky authentication failed.");
  return json.accessJwt;
}

async function searchPage(q: string, token: string, cursor?: string) {
  const url = new URL("https://bsky.social/xrpc/app.bsky.feed.searchPosts");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "50");
  url.searchParams.set("sort", "latest");
  if (cursor) url.searchParams.set("cursor", cursor);

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "AtlasOfDesires/0.2 research-art",
    },
    cache: "no-store",
  });
  const json = await response.json().catch(() => null) as { posts?: SearchPost[]; cursor?: string; message?: string } | null;
  if (!response.ok) throw new Error(json?.message || `Bluesky API error ${response.status}`);
  return { posts: json?.posts || [], cursor: json?.cursor || null };
}

export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams;
  const pages = Math.max(1, Math.min(5, Number(params.get("pages") || "3")));
  const queries = params.getAll("q");
  const selectedQueries = queries.length ? queries.slice(0, 16) : DEFAULT_QUERIES;

  try {
    const token = await createSession();
    const fetched: Array<{
      id: string;
      author: string | null;
      text: string;
      createdAt: string | null;
      query: string;
    }> = [];
    const perQuery: Array<{ query: string; pages: number; count: number; hasMore: boolean }> = [];

    for (const query of selectedQueries) {
      let cursor: string | null = null;
      let pageCount = 0;
      let count = 0;

      for (let page = 0; page < pages; page++) {
        const result = await searchPage(query, token, cursor || undefined);
        pageCount += 1;
        count += result.posts.length;
        for (const post of result.posts) {
          if (!post.uri) continue;
          fetched.push({
            id: post.uri,
            author: post.author?.did || null,
            text: post.record?.text || "",
            createdAt: post.record?.createdAt || null,
            query,
          });
        }
        cursor = result.cursor;
        if (!cursor) break;
      }

      perQuery.push({ query, pages: pageCount, count, hasMore: Boolean(cursor) });
    }

    const uniqueMap = new Map<string, typeof fetched[number] & { queries: string[] }>();
    for (const post of fetched) {
      const existing = uniqueMap.get(post.id);
      if (existing) existing.queries = [...new Set([...existing.queries, post.query])];
      else uniqueMap.set(post.id, { ...post, queries: [post.query] });
    }
    const unique = [...uniqueMap.values()];

    const byState: Record<string, number> = {};
    const byLanguage: Record<string, number> = {};
    const byAgency: Record<string, number> = {};
    const authorMap = new Map<string, Array<{ state: string; date: string | null }>>();

    for (const post of unique) {
      const interpretation = detectDesire(post.text);
      byState[interpretation.dream_state] = (byState[interpretation.dream_state] || 0) + 1;
      byLanguage[interpretation.language_hint] = (byLanguage[interpretation.language_hint] || 0) + 1;
      byAgency[interpretation.agency] = (byAgency[interpretation.agency] || 0) + 1;

      if (post.author) {
        const list = authorMap.get(post.author) || [];
        list.push({ state: interpretation.dream_state, date: post.createdAt });
        authorMap.set(post.author, list);
      }
    }

    let repeatAuthors = 0;
    let mixedStateAuthors = 0;
    const trajectoryCandidates: Array<{ states: string[]; count: number; first: string | null; last: string | null }> = [];

    for (const records of authorMap.values()) {
      if (records.length > 1) repeatAuthors += 1;
      const states = [...new Set(records.map(r => r.state))];
      if (states.length > 1) {
        mixedStateAuthors += 1;
        const dates = records.map(r => r.date).filter((d): d is string => Boolean(d)).sort();
        trajectoryCandidates.push({
          states,
          count: records.length,
          first: dates[0] || null,
          last: dates.at(-1) || null,
        });
      }
    }
    trajectoryCandidates.sort((a, b) => b.count - a.count);

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      pagesPerQuery: pages,
      perQuery,
      totalFetched: fetched.length,
      uniquePosts: unique.length,
      duplicates: fetched.length - unique.length,
      byState,
      byLanguage,
      byAgency,
      repeatAuthors,
      mixedStateAuthors,
      trajectoryCandidates: trajectoryCandidates.slice(0, 20),
      note: "Aggregate research snapshot only. Raw posts and author identifiers are intentionally omitted.",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Batch collection failed." }, { status: 502 });
  }
}
