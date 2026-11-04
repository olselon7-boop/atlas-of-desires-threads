
import { NextResponse } from "next/server";
import postgres from "postgres";

export const runtime = "nodejs";

export async function GET() {
  const url = process.env.POSTGRES_URL;
  if (!url) return NextResponse.json({ error: "POSTGRES_URL is not configured" }, { status: 503 });
  const db = postgres(url, { max: 1, ssl: "require" });
  try {
    const [counts, langs, states, deep, media, places, runs] = await Promise.all([
      db.unsafe("select (select count(*)::int from raw_posts) raw_posts, (select count(*)::int from desires) desires, (select count(*)::int from media_assets) media_assets, (select count(*)::int from places) places, (select count(*)::int from post_locations) post_locations, (select count(*)::int from conversation_edges) conversation_edges, (select count(*)::int from dream_trajectories) dream_trajectories"),
      db.unsafe("select language, count(*)::int count from raw_posts group by language order by count desc"),
      db.unsafe("select dream_state, count(*)::int count from desires group by dream_state order by count desc"),
      db.unsafe("select deep_desire, count(*)::int count from desires group by deep_desire order by count desc"),
      db.unsafe("select media_type, count(*)::int count from media_assets group by media_type order by count desc"),
      db.unsafe("select location_type, count(*)::int count from post_locations group by location_type order by count desc"),
      db.unsafe("select count(*)::int count, coalesce(sum(posts_received),0)::int received, coalesce(sum(posts_new),0)::int new_posts, coalesce(sum(estimated_cost_usd),0)::numeric cost from collection_runs where platform='x'")
    ]);
    const storage = await db.unsafe("select count(*) filter (where copy_status='copied')::int copied_images, coalesce(sum(storage_bytes) filter (where copy_status='copied'),0)::bigint copied_bytes, count(*) filter (where copy_status='failed')::int failed_copies from media_assets");
    return NextResponse.json({ counts: counts[0], byLanguage: langs, byState: states, byDeepDesire: deep, byMediaType: media, byLocationType: places, storage: storage[0], xCollection: runs[0] });
  } finally {
    await db.end({ timeout: 2 });
  }
}
