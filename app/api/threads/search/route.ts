import { NextRequest, NextResponse } from "next/server";
import { keywordSearch } from "@/lib/threads";

export async function GET(request: NextRequest) {
  const q = new URL(request.url).searchParams.get("q")?.trim();
  if (!q || q.length > 200) {
    return NextResponse.json({ error: "q is required and must be 1–200 characters" }, { status: 400 });
  }

  const token = request.cookies.get("threads_access_token")?.value || process.env.THREADS_ACCESS_TOKEN;
  if (!token) return NextResponse.json({ error: "No Threads access token. Authorize via /api/threads/auth first." }, { status: 401 });

  try {
    const result = await keywordSearch(q, token);
    const items = (result.data || []).map((item) => ({
      id: item.id ?? null,
      text: item.text ?? null,
      username: item.username ?? null,
      timestamp: item.timestamp ?? null,
      permalink: item.permalink ?? null,
    }));
    return NextResponse.json({ query: q, count: items.length, items });
  } catch (error) {
    const e = error as Error & { meta?: unknown };
    return NextResponse.json({ error: e.message, meta: e.meta ?? null }, { status: 502 });
  }
}
