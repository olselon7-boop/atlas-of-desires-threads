
import { NextResponse } from "next/server";
import postgres from "postgres";

export const runtime = "nodejs";

export async function GET() {
  if (process.env.VERCEL_ENV !== "preview") return NextResponse.json({ error: "Preview only" }, { status: 403 });
  const url = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
  if (!url) return NextResponse.json({ error: "DB URL missing" }, { status: 503 });
  const db = postgres(url, { max: 1, ssl: "require" });
  try {
    await db.unsafe(`
      alter table media_assets
        add column if not exists storage_bucket text,
        add column if not exists storage_path text,
        add column if not exists storage_bytes bigint,
        add column if not exists storage_mime_type text,
        add column if not exists storage_sha256 text,
        add column if not exists copy_status text default 'pending',
        add column if not exists copy_error text,
        add column if not exists copied_at timestamptz;
      create index if not exists media_assets_copy_status_idx on media_assets(copy_status);
    `);
    return NextResponse.json({ ok: true });
  } finally {
    await db.end({ timeout: 2 });
  }
}
