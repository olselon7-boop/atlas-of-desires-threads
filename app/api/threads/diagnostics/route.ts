import { NextRequest, NextResponse } from "next/server";
import { keywordSearch } from "@/lib/threads";
export async function GET(request: NextRequest) {
  const token = request.cookies.get("threads_access_token")?.value;
  if (!token) return NextResponse.json({ error: "Откройте эту ссылку в браузере, где подключён Threads." }, { status: 401 });
  const q = new URL(request.url).searchParams.get("q")?.trim() || "threads";
  if (q.length > 200) return NextResponse.json({ error: "Query too long" }, { status: 400 });
  const checks = await Promise.all((["RECENT", "TOP"] as const).map(async searchType => {
    try {
      const result = await keywordSearch(q, token, undefined, searchType, true);
      return { searchType, upstreamCount: result.data?.length ?? 0, idTypes: [...new Set((result.data || []).map(item => typeof item.id))], hasNextPage: Boolean(result.paging?.next) };
    } catch (e) { return { searchType, error: e instanceof Error ? e.message : "Request failed" }; }
  }));
  return NextResponse.json({ query: q, fields: "id,text", checks }, { headers: { "Cache-Control": "no-store" } });
}
