
import { NextRequest, NextResponse } from "next/server";
import postgres from "postgres";
import { buildXSearchUrl, estimateXPostReadCost } from "@/lib/x";
import { persistXSearchResponse, type XPersistResponse } from "@/lib/x-persistence";

export const runtime = "nodejs";

async function fetchConversation(token: string, conversationId: string, year: number) {
  const start = year + "-01-01T00:00:00Z";
  const end = Math.min(new Date(year + "-12-31T23:59:59Z").getTime(), Date.now() - 60000);
  const url = buildXSearchUrl({
    mode: "all",
    query: "conversation_id:" + conversationId + " -is:retweet",
    maxResults: 10,
    startTime: start,
    endTime: new Date(end).toISOString(),
  });
  const res = await fetch(url, {
    headers: { Authorization: "Bearer " + token, Accept: "application/json", "User-Agent": "AtlasOfDesires/0.8 conversation-research" },
    cache: "no-store",
  });
  const body = await res.json().catch(() => null) as XPersistResponse & { detail?: string; title?: string } | null;
  if (!res.ok) throw new Error(body?.detail || body?.title || "X API error " + res.status);
  return body || {};
}

export async function GET(req: NextRequest) {
  const token = process.env.X_BEARER_TOKEN;
  const dbUrl = process.env.POSTGRES_URL;
  if (!token || !dbUrl) return NextResponse.json({ error: "X or DB configuration missing" }, { status: 503 });

  const params = new URL(req.url).searchParams;
  const execute = params.get("execute") === "1";
  const persist = params.get("persist") === "1";
  const year = Number(params.get("year") || "2026");
  const limit = Math.max(1, Math.min(10, Number(params.get("limit") || "5")));

  const db = postgres(dbUrl, { max: 1, ssl: "require" });
  try {
    const roots = await db.unsafe(
      "select rp.id, rp.source_post_id, rp.conversation_id, rp.source_created_at from raw_posts rp join desires d on d.primary_post_id=rp.id where rp.platform='x' and rp.conversation_id is not null and extract(year from rp.source_created_at)=$1 and not exists (select 1 from conversation_edges ce where ce.parent_post_id=rp.id) order by rp.source_created_at desc limit $2",
      [year, limit]
    );

    if (!execute) {
      return NextResponse.json({
        mode: "dry-run",
        year,
        rootCount: roots.length,
        maxRepliesPerConversation: 10,
        estimatedMaxReadCostUsd: estimateXPostReadCost(roots.length * 10),
        roots: roots.map((r:any) => ({ sourcePostId: r.source_post_id, conversationId: r.conversation_id })),
      });
    }

    let repliesFetched = 0;
    let newReplies = 0;
    let edgesCreated = 0;
    const details:any[] = [];

    for (const root of roots as any[]) {
      const response = await fetchConversation(token, root.conversation_id, year);
      const filtered: XPersistResponse = {
        ...response,
        data: (response.data || []).filter(p => p.id && p.id !== root.source_post_id),
      };
      repliesFetched += filtered.data?.length || 0;

      let persistence:any = null;
      if (persist && filtered.data?.length) {
        persistence = await persistXSearchResponse({
          response: filtered,
          query: "conversation_id:" + root.conversation_id,
          year,
          estimatedCostUsd: estimateXPostReadCost(filtered.data.length),
        });
        newReplies += persistence.insertedPosts || 0;
      }

      for (const reply of filtered.data || []) {
        if (!reply.id) continue;
        const childRows = await db.unsafe("select id, parent_source_post_id from raw_posts where platform='x' and source_post_id=$1 limit 1", [reply.id]);
        if (!childRows.length) continue;
        const child = childRows[0] as any;
        let parentUuid = root.id;
        if (child.parent_source_post_id) {
          const parentRows = await db.unsafe("select id from raw_posts where platform='x' and source_post_id=$1 limit 1", [child.parent_source_post_id]);
          if (parentRows.length) parentUuid = parentRows[0].id;
        }
        const before = await db.unsafe("select id from conversation_edges where parent_post_id=$1 and child_post_id=$2 and relation_type='reply' limit 1", [parentUuid, child.id]);
        await db.unsafe("insert into conversation_edges (parent_post_id, child_post_id, relation_type) values ($1,$2,'reply') on conflict (parent_post_id, child_post_id, relation_type) do nothing", [parentUuid, child.id]);
        if (!before.length) edgesCreated++;
      }

      details.push({ root: root.source_post_id, conversationId: root.conversation_id, fetched: filtered.data?.length || 0, persistence });
    }

    return NextResponse.json({
      mode: "conversation-pilot",
      year,
      rootsProcessed: roots.length,
      repliesFetched,
      newReplies,
      edgesCreated,
      estimatedReadCostUsd: estimateXPostReadCost(repliesFetched),
      details,
      note: "Replies are stored raw and linked structurally. Relevance to a specific dream is not assumed yet.",
    });
  } finally {
    await db.end({ timeout: 2 });
  }
}
