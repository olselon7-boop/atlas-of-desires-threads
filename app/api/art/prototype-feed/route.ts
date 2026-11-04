
import { NextResponse } from "next/server";
import postgres from "postgres";

export const runtime = "nodejs";

export async function GET() {
  const url = process.env.POSTGRES_URL;
  if (!url) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  const db = postgres(url, { max: 1, ssl: "require" });
  try {
    const rows = await db.unsafe(`
      select
        d.id,
        d.surface_expression as text,
        d.deep_desire,
        d.dream_state,
        d.agency,
        d.language,
        d.confidence,
        extract(year from rp.source_created_at)::int as year,
        exists(select 1 from media_assets ma where ma.post_id = rp.id and ma.copy_status='copied') as has_media
      from desires d
      join raw_posts rp on rp.id = d.primary_post_id
      where rp.platform='x'
        and d.surface_expression is not null
        and length(d.surface_expression) between 8 and 280
        and coalesce(d.expression_type,'') not in ('advertisement','news','legacy_retweet','quote_lyrics','sleep_dream')
      order by rp.source_created_at desc
      limit 180
    `);
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      count: rows.length,
      desires: rows
    }, { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
  } finally {
    await db.end({ timeout: 2 });
  }
}
