export type XSearchMode = "recent" | "all";

export const X_API_BASE = "https://api.x.com/2";

export const X_RESEARCH_QUERIES = [
  '"я мечтаю" lang:ru -is:retweet',
  '"мечта сбылась" lang:ru -is:retweet',
  '"мечта исполнилась" lang:ru -is:retweet',
  '"исполнил мечту" lang:ru -is:retweet',
  '"осуществил мечту" lang:ru -is:retweet',
  '"I dream" lang:en -is:retweet',
  '"my dream came true" lang:en -is:retweet',
  '"I made my dream come true" lang:en -is:retweet',
  '"still dreaming" lang:en -is:retweet',
] as const;

export function buildXSearchUrl(input: {
  mode: XSearchMode;
  query: string;
  maxResults?: number;
  nextToken?: string | null;
  startTime?: string | null;
  endTime?: string | null;
}) {
  const endpoint = input.mode === "all" ? "/tweets/search/all" : "/tweets/search/recent";
  const url = new URL(X_API_BASE + endpoint);
  url.searchParams.set("query", input.query);
  url.searchParams.set("max_results", String(Math.max(10, Math.min(100, input.maxResults ?? 10))));
  url.searchParams.set(
    "tweet.fields",
    "id,text,author_id,created_at,conversation_id,lang,entities,attachments,geo,public_metrics,referenced_tweets"
  );
  url.searchParams.set("expansions", "author_id,attachments.media_keys,geo.place_id,referenced_tweets.id");
  url.searchParams.set("user.fields", "id,username,name,description,location,created_at,verified");
  url.searchParams.set("media.fields", "media_key,type,url,preview_image_url,width,height,alt_text");
  url.searchParams.set("place.fields", "id,full_name,country,country_code,geo,name,place_type");
  if (input.nextToken) url.searchParams.set("next_token", input.nextToken);
  if (input.startTime) url.searchParams.set("start_time", input.startTime);
  if (input.endTime) url.searchParams.set("end_time", input.endTime);
  return url;
}

export function estimateXPostReadCost(posts: number) {
  return Number((Math.max(0, posts) * 0.005).toFixed(4));
}


export const X_HISTORICAL_PERIODS = [
  { id: "2006-2010", start: "2006-03-21T00:00:00Z", end: "2010-12-31T23:59:59Z" },
  { id: "2011-2015", start: "2011-01-01T00:00:00Z", end: "2015-12-31T23:59:59Z" },
  { id: "2016-2020", start: "2016-01-01T00:00:00Z", end: "2020-12-31T23:59:59Z" },
  { id: "2021-2026", start: "2021-01-01T00:00:00Z", end: "2026-11-04T23:59:59Z" },
] as const;

export const X_HISTORICAL_FORMULAS = {
  ru: [
    '"я мечтаю" lang:ru -is:retweet',
    '"мечта сбылась" lang:ru -is:retweet',
  ],
  en: [
    '"I dream" lang:en -is:retweet',
    '"my dream came true" lang:en -is:retweet',
  ],
} as const;
