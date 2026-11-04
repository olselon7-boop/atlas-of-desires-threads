
import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import postgres from "postgres";

export const runtime = "nodejs";

const BUCKET = "atlas-source-media";

async function ensureBucket() {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error("Supabase Storage config missing");

  const headers = {
    Authorization: "Bearer " + key,
    apikey: key,
    "Content-Type": "application/json",
  };

  const list = await fetch(base + "/storage/v1/bucket", { headers, cache: "no-store" });
  if (!list.ok) throw new Error("Unable to list storage buckets: " + list.status);
  const buckets = await list.json() as Array<{ id?: string; name?: string }>;
  if (buckets.some(b => b.id === BUCKET || b.name === BUCKET)) return;

  const create = await fetch(base + "/storage/v1/bucket", {
    method: "POST",
    headers,
    body: JSON.stringify({
      id: BUCKET,
      name: BUCKET,
      public: false,
      file_size_limit: 10485760,
      allowed_mime_types: ["image/jpeg","image/png","image/webp","image/gif"],
    }),
  });
  if (!create.ok) {
    const msg = await create.text();
    throw new Error("Unable to create storage bucket: " + create.status + " " + msg);
  }
}

function extensionFor(contentType: string, sourceUrl: string) {
  const type = contentType.toLowerCase();
  if (type.includes("png")) return "png";
  if (type.includes("webp")) return "webp";
  if (type.includes("gif")) return "gif";
  if (type.includes("jpeg") || type.includes("jpg")) return "jpg";
  const m = sourceUrl.match(/\.([a-z0-9]{2,5})(?:\?|$)/i);
  return m?.[1]?.toLowerCase() || "bin";
}

export async function GET(req: NextRequest) {
  const dbUrl = process.env.POSTGRES_URL;
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!dbUrl || !base || !key) return NextResponse.json({ error: "DB or Storage config missing" }, { status: 503 });

  const params = new URL(req.url).searchParams;
  const execute = params.get("execute") === "1";
  const limit = Math.max(1, Math.min(10, Number(params.get("limit") || "5")));

  const db = postgres(dbUrl, { max: 1, ssl: "require" });
  try {
    const rows = await db.unsafe(
      "select ma.id, ma.source_url, ma.media_type, rp.platform, rp.source_post_id from media_assets ma join raw_posts rp on rp.id=ma.post_id where ma.source_url is not null and coalesce(ma.copy_status,'pending') in ('pending','failed') and (ma.media_type is null or ma.media_type in ('photo','image')) order by ma.created_at asc limit $1",
      [limit]
    );

    if (!execute) {
      return NextResponse.json({
        mode: "dry-run",
        bucket: BUCKET,
        count: rows.length,
        items: rows.map((r:any) => ({ id: r.id, platform: r.platform, sourcePostId: r.source_post_id })),
      });
    }

    await ensureBucket();

    const results:any[] = [];
    for (const row of rows as any[]) {
      try {
        const source = new URL(row.source_url);
        if (!["pbs.twimg.com","video.twimg.com"].includes(source.hostname)) {
          throw new Error("Unsupported source host: " + source.hostname);
        }

        const response = await fetch(row.source_url, { cache: "no-store", redirect: "follow" });
        if (!response.ok) throw new Error("Source fetch failed: " + response.status);

        const contentType = response.headers.get("content-type") || "application/octet-stream";
        if (!contentType.startsWith("image/")) throw new Error("Not an image: " + contentType);

        const buffer = Buffer.from(await response.arrayBuffer());
        if (buffer.length > 10 * 1024 * 1024) throw new Error("Image exceeds 10 MB");

        const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
        const ext = extensionFor(contentType, row.source_url);
        const path = row.platform + "/" + row.source_post_id + "/" + sha256.slice(0, 24) + "." + ext;

        const upload = await fetch(base + "/storage/v1/object/" + BUCKET + "/" + path, {
          method: "POST",
          headers: {
            Authorization: "Bearer " + key,
            apikey: key,
            "Content-Type": contentType,
            "x-upsert": "true",
          },
          body: buffer,
        });
        if (!upload.ok) {
          const msg = await upload.text();
          throw new Error("Storage upload failed: " + upload.status + " " + msg);
        }

        await db.unsafe(
          "update media_assets set storage_bucket=$1, storage_path=$2, storage_bytes=$3, storage_mime_type=$4, storage_sha256=$5, copy_status='copied', copy_error=null, copied_at=now() where id=$6",
          [BUCKET, path, buffer.length, contentType, sha256, row.id]
        );

        results.push({ id: row.id, status: "copied", bytes: buffer.length, path });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown copy error";
        await db.unsafe("update media_assets set copy_status='failed', copy_error=$1 where id=$2", [message.slice(0, 1000), row.id]);
        results.push({ id: row.id, status: "failed", error: message });
      }
    }

    return NextResponse.json({
      mode: "media-copy",
      bucket: BUCKET,
      processed: results.length,
      copied: results.filter(x => x.status === "copied").length,
      failed: results.filter(x => x.status === "failed").length,
      results,
    });
  } finally {
    await db.end({ timeout: 2 });
  }
}
