import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { detectDesire, type DesireState } from "@/lib/desire";

const QUERIES = [
  "я мечтаю",
  "все еще мечтаю",
  "до сих пор мечтаю",
  "мечтаю но не получается",
  "мечтаю но не сбывается",
  "мечта сбылась",
  "мечта исполнилась",
  "исполнил мечту",
  "осуществил мечту",
  "реализовал мечту",
  "I dream",
  "still dreaming",
  "dream came true",
  "my dream came true",
  "I made my dream come true",
  "achieved my dream",
];

type SearchPost = {
  uri?: string;
  author?: { did?: string; handle?: string };
  record?: { text?: string; createdAt?: string };
};

type CandidatePost = {
  uri: string;
  handle: string | null;
  authorDid: string;
  text: string;
  createdAt: string | null;
  state: DesireState;
  language: "ru" | "en" | "unknown";
  query: string;
};

const STOP = new Set([
  "я","мы","мне","меня","мой","моя","мои","мою","это","эта","этот","что","чтобы","как","так","но","и","а","в","на","с","со","по","для","к","ко","из","у","о","об","же","бы","был","была","были","есть","уже","еще","ещё","все","всё","до","сих","пор","просто","очень","теперь","наконец","мечта","мечты","мечту","мечтаю","мечтал","мечтала","сбылась","исполнилась","исполнил","исполнила","осуществил","осуществила","реализовал","реализовала",
  "i","me","my","mine","we","our","this","that","the","a","an","and","or","but","to","of","for","in","on","at","with","from","is","are","was","were","be","been","it","so","just","really","finally","still","dream","dreams","dreaming","came","come","true","made","make","achieved","achieve",
  "хочу","хотела","хотел","давно","буквально","раз","спасибо","больш","большое","месяц","год","лет","когда","тогда","потом","сейчас","сегодня","вообще","казалось",
]);

function normalizeToken(token: string) {
  let t = token.toLowerCase().replace(/ё/g, "е");
  if (/^[a-z]+$/.test(t)) {
    t = t.replace(/(?:ing|edly|edly|ed|ly|ies|s)$/i, "");
  } else if (/^[а-я]+$/i.test(t) && t.length > 3) {
    t = t.replace(/(?:иями|ями|ами|ого|ему|ому|ыми|ими|ий|ый|ой|ая|яя|ое|ее|ую|юю|ам|ям|ах|ях|ов|ев|ей|ом|ем|ы|и|а|я|у|ю|е)$/iu, "");
  }
  return t;
}

function contentTokens(text: string) {
  const raw = text.match(/[a-zа-яё0-9]{3,}/giu) || [];
  return [...new Set(raw.map(normalizeToken).filter(t => t.length >= 3 && !STOP.has(t)))];
}

function conceptTokens(text: string) {
  return [...new Set(contentTokens(text).map(token => token.length >= 5 ? token.slice(0, 4) : token))];
}

function isFirstPersonDream(text: string) {
  const firstPerson = /(?:^|\b)(?:я|мне|меня|мой|моя|мою|мы|нам|наш|i|me|my|we|our)(?:\b|$)/iu.test(text);
  const thirdPersonDream = /(?:он|она|они|he|she|they).{0,80}(?:мечтал|мечтала|мечтали|dreamed|dreamt|исполнил свою мечту|исполнила свою мечту)/iu.test(text);
  return firstPerson && !thirdPersonDream;
}

function similarity(a: string, b: string) {
  const ta = conceptTokens(a);
  const tb = conceptTokens(b);
  const aSet = new Set(ta);
  const bSet = new Set(tb);
  const shared = [...aSet].filter(t => bSet.has(t));
  const union = new Set([...ta, ...tb]);
  const jaccard = union.size ? shared.length / union.size : 0;
  const containment = Math.min(ta.length, tb.length) ? shared.length / Math.min(ta.length, tb.length) : 0;
  const score = Math.min(1, jaccard * 0.5 + containment * 0.5);
  return { score, shared: shared.slice(0, 10), tokensA: ta, tokensB: tb };
}

function pseudoAuthor(did: string) {
  const secret = process.env.ATLAS_PSEUDONYM_SALT || process.env.THREADS_APP_SECRET || "atlas-review";
  return crypto.createHmac("sha256", secret).update(`bluesky:${did}`).digest("hex").slice(0, 12);
}

function postUrl(post: CandidatePost) {
  const rkey = post.uri.split("/").at(-1);
  return post.handle && rkey ? `https://bsky.app/profile/${encodeURIComponent(post.handle)}/post/${encodeURIComponent(rkey)}` : null;
}

async function sessionToken() {
  const identifier = process.env.BSKY_IDENTIFIER;
  const password = process.env.BSKY_APP_PASSWORD;
  if (!identifier || !password) throw new Error("Bluesky credentials are not configured.");
  const response = await fetch("https://bsky.social/xrpc/com.atproto.server.createSession", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ identifier, password }),
    cache: "no-store",
  });
  const body = await response.json().catch(() => null) as { accessJwt?: string } | null;
  if (!response.ok || !body?.accessJwt) throw new Error("Bluesky authentication failed.");
  return body.accessJwt;
}

async function search(q: string, token: string, pages: number) {
  const posts: CandidatePost[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < pages; page++) {
    const url = new URL("https://bsky.social/xrpc/app.bsky.feed.searchPosts");
    url.searchParams.set("q", q);
    url.searchParams.set("limit", "50");
    url.searchParams.set("sort", "latest");
    if (cursor) url.searchParams.set("cursor", cursor);
    const response = await fetch(url, {
      headers: { Accept: "application/json", Authorization: `Bearer ${token}`, "User-Agent": "AtlasOfDesires/0.3 research-art" },
      cache: "no-store",
    });
    const body = await response.json().catch(() => null) as { posts?: SearchPost[]; cursor?: string; message?: string } | null;
    if (!response.ok) throw new Error(body?.message || `Bluesky API error ${response.status}`);
    for (const post of body?.posts || []) {
      const did = post.author?.did;
      const uri = post.uri;
      const text = post.record?.text || "";
      if (!did || !uri || !text) continue;
      const interpretation = detectDesire(text);
      posts.push({
        uri,
        handle: post.author?.handle || null,
        authorDid: did,
        text,
        createdAt: post.record?.createdAt || null,
        state: interpretation.dream_state,
        language: interpretation.language_hint,
        query: q,
      });
    }
    cursor = body?.cursor || null;
    if (!cursor) break;
  }
  return posts;
}

const BEFORE = new Set<DesireState>(["dreaming", "stalled", "struggling", "transformed", "unknown"]);
const AFTER = new Set<DesireState>(["fulfilled_passive", "fulfilled_active"]);

export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams;
  const pages = Math.max(1, Math.min(5, Number(params.get("pages") || "4")));
  const language = params.get("language") || "all";
  const limit = Math.max(1, Math.min(30, Number(params.get("limit") || "12")));

  try {
    const token = await sessionToken();
    const fetched: CandidatePost[] = [];
    for (const q of QUERIES) fetched.push(...await search(q, token, pages));

    const unique = new Map<string, CandidatePost>();
    for (const post of fetched) if (!unique.has(post.uri)) unique.set(post.uri, post);

    const byAuthor = new Map<string, CandidatePost[]>();
    for (const post of unique.values()) {
      if (language !== "all" && post.language !== language) continue;
      const list = byAuthor.get(post.authorDid) || [];
      list.push(post);
      byAuthor.set(post.authorDid, list);
    }

    const pairs: Array<{
      authorKey: string;
      score: number;
      sharedTerms: string[];
      elapsedDays: number | null;
      before: CandidatePost;
      after: CandidatePost;
    }> = [];

    for (const [did, records] of byAuthor) {
      const sorted = [...records].sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
      for (let i = 0; i < sorted.length; i++) {
        for (let j = i + 1; j < sorted.length; j++) {
          const before = sorted[i];
          const after = sorted[j];
          if (!BEFORE.has(before.state) || !AFTER.has(after.state)) continue;
          if (!isFirstPersonDream(before.text) || !isFirstPersonDream(after.text)) continue;
          if (before.language !== after.language && before.language !== "unknown" && after.language !== "unknown") continue;
          const sim = similarity(before.text, after.text);
          const elapsedDays = before.createdAt && after.createdAt
            ? Math.round((new Date(after.createdAt).getTime() - new Date(before.createdAt).getTime()) / 86400000)
            : null;
          const strongLexical = sim.shared.length >= 2 && sim.score >= 0.08;
          if (!strongLexical) continue;
          pairs.push({ authorKey: pseudoAuthor(did), score: sim.score, sharedTerms: sim.shared, elapsedDays, before, after });
        }
      }
    }

    pairs.sort((a, b) => b.score - a.score || (b.elapsedDays || 0) - (a.elapsedDays || 0));

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      pagesPerQuery: pages,
      language,
      scannedUniquePosts: unique.size,
      candidatePairs: pairs.slice(0, limit).map(pair => ({
        authorKey: pair.authorKey,
        similarity: Number(pair.score.toFixed(3)),
        sharedTerms: pair.sharedTerms,
        elapsedDays: pair.elapsedDays,
        before: {
          date: pair.before.createdAt,
          state: pair.before.state,
          language: pair.before.language,
          text: pair.before.text,
          url: postUrl(pair.before),
        },
        after: {
          date: pair.after.createdAt,
          state: pair.after.state,
          language: pair.after.language,
          text: pair.after.text,
          url: postUrl(pair.after),
        },
      })),
      warning: "Candidate pairs are hypotheses for manual review. Same author + lexical similarity does not prove the same dream.",
    }, { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Trajectory review failed." }, { status: 502 });
  }
}
