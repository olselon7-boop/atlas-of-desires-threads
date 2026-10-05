import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { keywordSearch } from "@/lib/threads";
import { detectDesire, type DesireRecord } from "@/lib/desire";

export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams;
  const q = params.get("q")?.trim();
  const after = params.get("after") || undefined;
  if (!q || q.length > 200 || (after && after.length > 2048)) return NextResponse.json({ error: "Некорректный запрос или курсор страницы." }, { status: 400 });
  const token = request.cookies.get("threads_access_token")?.value || process.env.THREADS_ACCESS_TOKEN;
  if (!token) return NextResponse.json({ error: "Сначала подключите Threads в этом браузере." }, { status: 401 });
  try {
    const result = await keywordSearch(q, token, after);
    const collectedAt = new Date().toISOString();
    const str = (value: unknown) => typeof value === "string" ? value : null;
    const link = (value: unknown) => {
      const s = str(value);
      if (!s) return null;
      try { const u = new URL(s); return u.protocol === "https:" ? s : null; } catch { return null; }
    };
    const records: DesireRecord[] = (result.data || []).filter(item => typeof item.id === "string").map(item => {
      const text = str(item.text) || "";
      return {
        id: crypto.createHash("sha256").update(`threads:${item.id}`).digest("hex"),
        source: { platform: "threads", post_id: String(item.id), original_text: text, timestamp: str(item.timestamp), permalink: link(item.permalink), queries: [q], collected_at: collectedAt },
        media: { type: str(item.media_type), url: link(item.media_url), thumbnail_url: link(item.thumbnail_url) },
        interpretation: detectDesire(text), place: { city: null, country: null, source: null }, review: "unreviewed",
      };
    });
    // Never return Meta's paging.next URL: it can contain the access token.
    return NextResponse.json({ records, nextCursor: result.paging?.next ? result.paging.cursors?.after ?? null : null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Threads не ответил. Попробуйте ещё раз." }, { status: 502 });
  }
}
