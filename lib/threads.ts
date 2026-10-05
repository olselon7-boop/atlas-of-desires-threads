const THREADS_API = "https://graph.threads.net";
const THREADS_AUTH = "https://threads.net/oauth/authorize";

export function env() {
  const appId = process.env.THREADS_APP_ID;
  const appSecret = process.env.THREADS_APP_SECRET;
  const redirectUri = process.env.THREADS_REDIRECT_URI;
  return { appId, appSecret, redirectUri };
}

export function requireThreadsEnv() {
  const { appId, appSecret, redirectUri } = env();
  if (!appId || !appSecret || !redirectUri) {
    throw new Error("Missing THREADS_APP_ID, THREADS_APP_SECRET or THREADS_REDIRECT_URI");
  }
  return { appId, appSecret, redirectUri };
}

export function buildAuthUrl(state: string) {
  const { appId, redirectUri } = requireThreadsEnv();
  const url = new URL(THREADS_AUTH);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "threads_basic,threads_keyword_search,threads_profile_discovery");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeCode(code: string) {
  const { appId, appSecret, redirectUri } = requireThreadsEnv();
  const body = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
    code,
  });

  const res = await fetch(`${THREADS_API}/oauth/access_token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data as { access_token: string; user_id?: string | number };
}

export async function exchangeLongLived(shortToken: string) {
  const { appSecret } = requireThreadsEnv();
  const url = new URL(`${THREADS_API}/access_token`);
  url.searchParams.set("grant_type", "th_exchange_token");
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("access_token", shortToken);

  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15000) });
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data as { access_token: string; token_type?: string; expires_in?: number };
}

export async function keywordSearch(q: string, token: string, after?: string) {
  const url = new URL(`${THREADS_API}/keyword_search`);
  url.searchParams.set("q", q);
  url.searchParams.set("search_type", "RECENT");
  url.searchParams.set("fields", "id,text,username,timestamp,permalink,media_type,media_url,thumbnail_url");
  url.searchParams.set("limit", "50");
  if (after) url.searchParams.set("after", after);
  url.searchParams.set("access_token", token);

  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15000) });
  const data = await res.json();
  if (!res.ok) {
    const e = new Error(data?.error?.message || "Threads keyword_search failed");
    (e as Error & { meta?: unknown }).meta = data?.error;
    throw e;
  }
  return data as { data?: Array<Record<string, unknown>>; paging?: { cursors?: { after?: string }; next?: string } };
}

export { THREADS_API };
