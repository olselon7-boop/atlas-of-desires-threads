import { buildXSearchUrl } from "@/lib/x";

export type RadioXPost = {
  id: string;
  text: string;
  author_id?: string;
  created_at?: string;
  conversation_id?: string;
  lang?: string;
  attachments?: { media_keys?: string[] };
  geo?: { place_id?: string };
  referenced_tweets?: Array<{ type?: string; id?: string }>;
  [key: string]: unknown;
};

export type RadioXResponse = {
  data?: RadioXPost[];
  includes?: {
    users?: Array<Record<string, any> & { id?: string }>;
    tweets?: RadioXPost[];
    media?: Array<Record<string, any> & {
      media_key?: string;
      type?: string;
      url?: string;
      preview_image_url?: string;
      width?: number;
      height?: number;
      alt_text?: string;
      duration_ms?: number;
      variants?: Array<{ bit_rate?: number; content_type?: string; url?: string }>;
    }>;
    places?: Array<Record<string, any> & { id?: string }>;
  };
  meta?: {
    newest_id?: string;
    oldest_id?: string;
    result_count?: number;
    next_token?: string;
  };
  title?: string;
  detail?: string;
};

export const RADIO_DREAM_QUERIES = {
  ru: '("я мечтаю" OR "всегда мечтал" OR "всегда мечтала" OR "давно мечтаю" OR "мечта детства" OR "мечта всей жизни" OR "мечтаю стать" OR "мечтаю жить" OR "мечтаю поехать" OR "мечтаю переехать" OR "мечта сбылась" OR "мечта исполнилась" OR "исполнил мечту" OR "исполнила мечту" OR "осуществил мечту" OR "осуществила мечту" OR "реализовал мечту" OR "реализовала мечту") lang:ru -is:retweet',
  en: '("I dream of" OR "I dream about" OR "always dreamed of" OR "lifelong dream" OR "dream of becoming" OR "dream of living" OR "dream of moving" OR "dream of traveling" OR "my dream came true" OR "I achieved my dream" OR "I made my dream come true") lang:en -is:retweet'
} as const;

export function startOfTodayAmsterdamIso() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const year = Number(parts.find(p=>p.type==="year")?.value || now.getUTCFullYear());
  const month = Number(parts.find(p=>p.type==="month")?.value || now.getUTCMonth()+1);
  const day = Number(parts.find(p=>p.type==="day")?.value || now.getUTCDate());
  const offsetName = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Amsterdam",
    timeZoneName: "shortOffset",
    hour: "2-digit"
  }).formatToParts(new Date(Date.UTC(year,month-1,day,12)))
    .find(p=>p.type==="timeZoneName")?.value || "GMT+1";
  const match = offsetName.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  const sign = match?.[1] === "-" ? -1 : 1;
  const hours = Number(match?.[2] || 0);
  const minutes = Number(match?.[3] || 0);
  const offsetMs = sign * (hours*60 + minutes) * 60_000;
  return new Date(Date.UTC(year,month-1,day,0,0,0) - offsetMs).toISOString();
}

async function fetchPage(token:string, query:string, options?:{
  sinceId?:string|null;
  nextToken?:string|null;
}) {
  const url = buildXSearchUrl({
    mode:"recent",
    query,
    maxResults:100,
    nextToken:options?.nextToken || null,
    startTime:options?.sinceId ? null : startOfTodayAmsterdamIso()
  });
  if(options?.sinceId) url.searchParams.set("since_id",options.sinceId);
  const response=await fetch(url,{
    headers:{
      Authorization:`Bearer ${token}`,
      Accept:"application/json",
      "User-Agent":"AtlasOfDesires/1.0 radio-dreams"
    },
    cache:"no-store"
  });
  const body=(await response.json().catch(()=>({}))) as RadioXResponse;
  if(!response.ok) throw new Error(body.detail || body.title || `X API error ${response.status}`);
  return body;
}

export async function fetchRadioDreamPages(token:string, language:"ru"|"en", sinceId?:string|null) {
  const pages:RadioXResponse[]=[];
  let nextToken:string|null=null;
  for(let page=0;page<50;page++){
    const body=await fetchPage(token,RADIO_DREAM_QUERIES[language],{
      sinceId:sinceId || null,
      nextToken
    });
    pages.push(body);
    nextToken=body.meta?.next_token || null;
    if(!nextToken) break;
  }
  return pages;
}
