import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { detectDesire, type DesireRecord } from "@/lib/desire";

type BlueskyPost = {
  uri?: unknown;
  author?: { did?: unknown; handle?: unknown };
  record?: { text?: unknown; createdAt?: unknown };
  embed?: {
    images?: Array<{ fullsize?: unknown; thumb?: unknown }>;
    external?: { external?: { uri?: unknown; thumb?: unknown } };
  };
};

function stringValue(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function safeHttps(value: unknown): string | null {
  const s = stringValue(value);
  if (!s) return null;
  try {
    const url = new URL(s);
    return url.protocol === "https:" ? s : null;
  } catch {
    return null;
  }
}

function postKey(uri: string) {
  return crypto.createHash("sha256").update(`bluesky:${uri}`).digest("hex");
}

function authorKey(did: string | null) {
  if (!did) return null;
  const secret = process.env.ATLAS_PSEUDONYM_SALT || process.env.THREADS_APP_SECRET || "atlas-local-research";
  return crypto.createHmac("sha256", secret).update(`bluesky:${did}`).digest("hex");
}

function permalink(uri: string | null, handle: string | null) {
  if (!uri || !handle) return null;
  const parts = uri.split("/");
  const rkey = parts.at(-1);
  return rkey ? `https://bsky.app/profile/${encodeURIComponent(handle)}/post/${encodeURIComponent(rkey)}` : null;
}

export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams;
  const q = params.get("q")?.trim();
  const cursor = params.get("cursor") || undefined;

  if (!q || q.length > 200 || (cursor && cursor.length > 2048)) {
    return NextResponse.json({ error: "Некорректный запрос или курсор страницы." }, { status: 400 });
  }

  const upstream = new URL("https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts");
  upstream.searchParams.set("q", q);
  upstream.searchParams.set("limit", "50");
  upstream.searchParams.set("sort", "latest");
  if (cursor) upstream.searchParams.set("cursor", cursor);

  try {
    const response = await fetch(upstream, {
      headers: { Accept: "application/json", "User-Agent": "AtlasOfDesires/0.2 research-art" },
      cache: "no-store",
    });

    const raw = await response.json().catch(() => null) as { posts?: BlueskyPost[]; cursor?: unknown; message?: unknown } | null;
    if (!response.ok) {
      const message = raw && typeof raw.message === "string" ? raw.message : `Bluesky API error ${response.status}`;
      throw new Error(message);
    }

    const collectedAt = new Date().toISOString();
    const records: DesireRecord[] = (raw?.posts || []).flatMap(post => {
      const uri = stringValue(post.uri);
      if (!uri) return [];
      const text = stringValue(post.record?.text) || "";
      const did = stringValue(post.author?.did);
      const handle = stringValue(post.author?.handle);
      const firstImage = Array.isArray(post.embed?.images) ? post.embed?.images?.[0] : undefined;
      const external = post.embed?.external?.external;
      const mediaUrl = safeHttps(firstImage?.fullsize) || safeHttps(external?.uri);
      const thumb = safeHttps(firstImage?.thumb) || safeHttps(external?.thumb);

      return [{
        id: postKey(uri),
        source: {
          platform: "bluesky",
          post_id: uri,
          author_key: authorKey(did),
          original_text: text,
          timestamp: stringValue(post.record?.createdAt),
          permalink: permalink(uri, handle),
          queries: [q],
          collected_at: collectedAt,
        },
        media: {
          type: firstImage ? "IMAGE" : external ? "EXTERNAL" : null,
          url: mediaUrl,
          thumbnail_url: thumb,
        },
        interpretation: detectDesire(text),
        place: { city: null, country: null, source: null },
        review: "unreviewed" as const,
      }];
    });

    return NextResponse.json(
      { records, nextCursor: stringValue(raw?.cursor), source: "bluesky" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Bluesky не ответил. Попробуйте ещё раз." },
      { status: 502 },
    );
  }
}
