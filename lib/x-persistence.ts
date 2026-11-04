
import crypto from "node:crypto";
import postgres from "postgres";
import { enrichDesireText } from "@/lib/desire-enrichment";

export type XPersistResponse = {
  data?: Array<{
    id?: string;
    text?: string;
    author_id?: string;
    created_at?: string;
    conversation_id?: string;
    lang?: string;
    attachments?: { media_keys?: string[] };
    geo?: { place_id?: string };
    referenced_tweets?: Array<{ type?: string; id?: string }>;
    [key: string]: unknown;
  }>;
  includes?: {
    users?: Array<Record<string, any> & { id?: string }>;
    media?: Array<Record<string, any> & { media_key?: string }>;
    places?: Array<Record<string, any> & { id?: string }>;
  };
};

function pseudonym(platform: string, sourceAuthorId: string) {
  return crypto.createHash("sha256").update(platform + ":" + sourceAuthorId).digest("hex");
}

export async function persistXSearchResponse(input: {
  response: XPersistResponse;
  query: string;
  year: number;
  estimatedCostUsd: number;
}) {
  const url = process.env.POSTGRES_URL;
  if (!url) throw new Error("POSTGRES_URL is not configured");
  const db = postgres(url, { max: 1, ssl: "require" });

  const users = new Map((input.response.includes?.users || []).filter(x => x.id).map(x => [x.id as string, x]));
  const media = new Map((input.response.includes?.media || []).filter(x => x.media_key).map(x => [x.media_key as string, x]));
  const places = new Map((input.response.includes?.places || []).filter(x => x.id).map(x => [x.id as string, x]));

  try {
    const runRows = await db.unsafe(
      "insert into collection_runs (platform, query, start_time, end_time, posts_requested, posts_received, estimated_cost_usd, status, metadata) values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb) returning id",
      ["x", input.query, input.year + "-01-01T00:00:00Z", input.year + "-12-31T23:59:59Z", 10, input.response.data?.length || 0, input.estimatedCostUsd, "completed", JSON.stringify({ mode: "high-recall", year: input.year })]
    );
    const runId = runRows[0].id as string;

    let insertedPosts = 0;
    let insertedDesires = 0;
    let insertedMedia = 0;
    let insertedPlaces = 0;

    for (const post of input.response.data || []) {
      if (!post.id || !post.text) continue;

      let authorUuid: string | null = null;
      if (post.author_id) {
        const u = users.get(post.author_id) || {};
        const authorRows = await db.unsafe(
          "insert into authors_protected (platform, source_author_id, username, display_name, profile_description, profile_location, pseudonymous_key, raw_payload) values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb) on conflict (platform, source_author_id) do update set username=excluded.username, display_name=excluded.display_name, profile_description=excluded.profile_description, profile_location=excluded.profile_location, raw_payload=excluded.raw_payload returning id",
          ["x", post.author_id, u.username || null, u.name || null, u.description || null, u.location || null, pseudonym("x", post.author_id), JSON.stringify(u)]
        );
        authorUuid = authorRows[0].id as string;
      }

      const beforePost = await db.unsafe("select id from raw_posts where platform=$1 and source_post_id=$2 limit 1", ["x", post.id]);
      const postRows = await db.unsafe(
        "insert into raw_posts (platform, source_post_id, author_id, original_text, language, source_created_at, permalink, conversation_id, post_type, raw_payload, collection_run_id) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11) on conflict (platform, source_post_id) do update set original_text=excluded.original_text, language=excluded.language, raw_payload=excluded.raw_payload returning id",
        ["x", post.id, authorUuid, post.text, post.lang || null, post.created_at || null, "https://x.com/i/web/status/" + post.id, post.conversation_id || null, post.referenced_tweets?.[0]?.type || "original", JSON.stringify({ post, query: input.query }), runId]
      );
      const postUuid = postRows[0].id as string;
      if (!beforePost.length) insertedPosts++;

      for (const key of post.attachments?.media_keys || []) {
        const m = media.get(key);
        if (!m) continue;
        const before = await db.unsafe("select id from media_assets where post_id=$1 and platform_media_id=$2 limit 1", [postUuid, key]);
        await db.unsafe(
          "insert into media_assets (post_id, platform_media_id, media_type, source_url, preview_url, width, height, alt_text, raw_payload) values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb) on conflict (post_id, platform_media_id) do update set source_url=excluded.source_url, preview_url=excluded.preview_url, width=excluded.width, height=excluded.height, alt_text=excluded.alt_text, raw_payload=excluded.raw_payload",
          [postUuid, key, m.type || null, m.url || null, m.preview_image_url || null, m.width || null, m.height || null, m.alt_text || null, JSON.stringify(m)]
        );
        if (!before.length) insertedMedia++;
      }

      if (post.geo?.place_id) {
        const p = places.get(post.geo.place_id);
        if (p) {
          const before = await db.unsafe("select id from places where platform=$1 and source_place_id=$2 limit 1", ["x", post.geo.place_id]);
          const placeRows = await db.unsafe(
            "insert into places (platform, source_place_id, name, city, country, country_code, place_type, raw_payload) values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb) on conflict (platform, source_place_id) do update set name=excluded.name, city=excluded.city, country=excluded.country, country_code=excluded.country_code, place_type=excluded.place_type, raw_payload=excluded.raw_payload returning id",
            ["x", post.geo.place_id, p.name || p.full_name || null, p.full_name || null, p.country || null, p.country_code || null, p.place_type || null, JSON.stringify(p)]
          );
          await db.unsafe(
            "insert into post_locations (post_id, place_id, location_type, confidence, is_platform_fact, evidence) values ($1,$2,$3,$4,$5,$6) on conflict (post_id, place_id, location_type) do nothing",
            [postUuid, placeRows[0].id, "platform_place", 1, true, "X geo.place_id"]
          );
          if (!before.length) insertedPlaces++;
        }
      }

      const enriched = enrichDesireText(post.text);
      const existingDesire = await db.unsafe("select id from desires where primary_post_id=$1 limit 1", [postUuid]);
      if (!existingDesire.length) {
        await db.unsafe(
          "insert into desires (primary_post_id, pseudonymous_author_key, language, surface_expression, canonical_desire, deep_desire, expression_type, aspiration_subject, is_human_aspiration, dream_state, agency, duration_mentioned, confidence, extraction_method, requires_review) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)",
          [postUuid, post.author_id ? pseudonym("x", post.author_id) : null, post.lang || enriched.language_hint, post.text, enriched.canonical_desire, enriched.deep_desire, enriched.expression_type, enriched.aspiration_subject, enriched.is_human_aspiration, enriched.lifecycle_state, enriched.agency, enriched.duration_mentioned, enriched.confidence, enriched.method, true]
        );
        insertedDesires++;
      }
    }

    await db.unsafe(
      "update collection_runs set finished_at=now(), posts_new=$1, posts_duplicate=$2 where id=$3",
      [insertedPosts, (input.response.data?.length || 0) - insertedPosts, runId]
    );

    return { collectionRunId: runId, received: input.response.data?.length || 0, insertedPosts, insertedDesires, insertedMedia, insertedPlaces };
  } finally {
    await db.end({ timeout: 2 });
  }
}
