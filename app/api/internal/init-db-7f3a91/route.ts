import { NextResponse } from "next/server";
import postgres from "postgres";

export const runtime = "nodejs";

const schemaSql = String.raw`-- Atlas of Desires research database schema
-- PostgreSQL + pgcrypto. pgvector can be added when embeddings are introduced.

create extension if not exists pgcrypto;

create table if not exists collection_runs (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  query text,
  started_at timestamptz default now(),
  finished_at timestamptz,
  start_time timestamptz,
  end_time timestamptz,
  posts_requested integer,
  posts_received integer,
  posts_new integer,
  posts_duplicate integer,
  estimated_cost_usd numeric,
  cursor text,
  status text,
  metadata jsonb default '{}'::jsonb
);

create table if not exists authors_protected (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  source_author_id text not null,
  username text,
  display_name text,
  profile_description text,
  profile_location text,
  pseudonymous_key text not null,
  raw_payload jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  unique(platform, source_author_id)
);

create table if not exists raw_posts (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  source_post_id text not null,
  author_id uuid references authors_protected(id),
  original_text text,
  language text,
  source_created_at timestamptz,
  collected_at timestamptz default now(),
  permalink text,
  conversation_id text,
  parent_source_post_id text,
  root_source_post_id text,
  post_type text,
  raw_payload jsonb default '{}'::jsonb,
  collection_run_id uuid references collection_runs(id),
  unique(platform, source_post_id)
);

create index if not exists raw_posts_platform_created_idx
  on raw_posts(platform, source_created_at);
create index if not exists raw_posts_conversation_idx
  on raw_posts(platform, conversation_id);

create table if not exists media_assets (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references raw_posts(id) on delete cascade,
  platform_media_id text,
  media_type text,
  source_url text,
  preview_url text,
  width integer,
  height integer,
  alt_text text,
  raw_payload jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  unique(post_id, platform_media_id)
);

create table if not exists places (
  id uuid primary key default gen_random_uuid(),
  platform text,
  source_place_id text,
  name text,
  city text,
  region text,
  country text,
  country_code text,
  latitude numeric,
  longitude numeric,
  place_type text,
  raw_payload jsonb default '{}'::jsonb,
  unique(platform, source_place_id)
);

create table if not exists post_locations (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references raw_posts(id) on delete cascade,
  place_id uuid references places(id),
  location_type text not null,
  confidence numeric,
  is_platform_fact boolean default false,
  evidence text,
  unique(post_id, place_id, location_type)
);

create table if not exists conversation_edges (
  id uuid primary key default gen_random_uuid(),
  parent_post_id uuid references raw_posts(id) on delete cascade,
  child_post_id uuid references raw_posts(id) on delete cascade,
  relation_type text not null,
  unique(parent_post_id, child_post_id, relation_type)
);

create table if not exists desires (
  id uuid primary key default gen_random_uuid(),
  primary_post_id uuid references raw_posts(id) on delete cascade,
  pseudonymous_author_key text,
  language text,
  surface_expression text,
  canonical_desire text,
  deep_desire text,
  dream_object text,
  expression_type text,
  aspiration_subject text,
  is_human_aspiration boolean,
  modality text,
  dream_state text,
  agency text,
  duration_mentioned text,
  emotion jsonb,
  desire_horizon text,
  desire_scale text,
  confidence numeric,
  extraction_method text,
  extraction_model text,
  requires_review boolean default true,
  created_at timestamptz default now()
);

create index if not exists desires_deep_desire_idx on desires(deep_desire);
create index if not exists desires_state_idx on desires(dream_state);
create index if not exists desires_human_idx on desires(is_human_aspiration);

create table if not exists desire_post_links (
  id uuid primary key default gen_random_uuid(),
  desire_id uuid not null references desires(id) on delete cascade,
  post_id uuid not null references raw_posts(id) on delete cascade,
  relation_type text not null,
  relation_confidence numeric,
  text_evidence text,
  visual_evidence jsonb,
  reviewed boolean default false,
  unique(desire_id, post_id)
);

create table if not exists visual_analysis (
  id uuid primary key default gen_random_uuid(),
  media_id uuid not null references media_assets(id) on delete cascade,
  analysis_model text,
  analyzed_at timestamptz default now(),
  description text,
  objects jsonb,
  visual_motifs jsonb,
  scene_type text,
  mood jsonb,
  visual_role text,
  dream_object_visual text,
  text_image_alignment text,
  contains_people boolean,
  contains_readable_text boolean,
  confidence numeric,
  raw_analysis jsonb default '{}'::jsonb
);

create table if not exists dream_trajectories (
  id uuid primary key default gen_random_uuid(),
  pseudonymous_author_key text,
  canonical_dream_object text,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  fulfillment_at timestamptz,
  duration_days numeric,
  current_state text,
  same_dream_confidence numeric,
  review_status text,
  created_at timestamptz default now()
);

create table if not exists trajectory_events (
  id uuid primary key default gen_random_uuid(),
  trajectory_id uuid not null references dream_trajectories(id) on delete cascade,
  desire_id uuid references desires(id),
  post_id uuid references raw_posts(id),
  event_type text,
  event_at timestamptz,
  sequence_no integer,
  evidence jsonb default '{}'::jsonb
);

create table if not exists manual_reviews (
  id uuid primary key default gen_random_uuid(),
  entity_type text,
  entity_id uuid,
  review_type text,
  decision text,
  reviewer text,
  notes text,
  created_at timestamptz default now()
);

create table if not exists analysis_runs (
  id uuid primary key default gen_random_uuid(),
  analysis_type text,
  model text,
  version text,
  prompt_version text,
  started_at timestamptz default now(),
  finished_at timestamptz,
  records_processed integer,
  metadata jsonb default '{}'::jsonb
);

create table if not exists art_ready_desires (
  id uuid primary key default gen_random_uuid(),
  desire_id uuid not null references desires(id) on delete cascade,
  public_text text,
  language text,
  deep_desire text,
  dream_object text,
  dream_state text,
  timestamp timestamptz,
  visual_motifs jsonb,
  art_media_url text,
  country text,
  city text,
  location_precision text,
  cluster_id text,
  trajectory_id uuid references dream_trajectories(id),
  approved_for_public boolean default false,
  unique(desire_id)
);
`;

export async function GET() {
  if (process.env.VERCEL_ENV !== "preview") {
    return NextResponse.json({ error: "Preview only." }, { status: 403 });
  }

  const url = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
  if (!url) {
    return NextResponse.json({ error: "Database URL missing." }, { status: 503 });
  }

  const sql = postgres(url, { max: 1, ssl: "require" });
  try {
    await sql.unsafe(schemaSql);
    const tables = await sql`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_name in (
          'collection_runs','authors_protected','raw_posts','media_assets','places',
          'post_locations','conversation_edges','desires','desire_post_links',
          'visual_analysis','dream_trajectories','trajectory_events',
          'manual_reviews','analysis_runs','art_ready_desires'
        )
      order by table_name
    `;
    return NextResponse.json({ ok: true, tableCount: tables.length, tables: tables.map(t => t.table_name) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown database init error." },
      { status: 500 }
    );
  } finally {
    await sql.end({ timeout: 2 });
  }
}
