import { detectDesire, mergeCorpus, type DesireRecord } from "./desire.ts";
import { extractDreamObject } from "./dream-object.ts";
import { emptyVisual, parseVisualOutput, type VisualAnalysis } from "./visual-schema.ts";
export const CORPUS_STORAGE = "atlas-research-corpus-v2";
export const REVIEW_STORAGE = "atlas-trajectory-reviews-v1";
const obj = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
const str = (v: unknown, max = 20000): string | null => typeof v === "string" ? v.slice(0,max) : null;
export function httpsUrl(v: unknown): string | null {
  try { const u = new URL(String(v)); return u.protocol === "https:" && !u.username && !u.password ? u.toString() : null; } catch { return null; }
}
export function hasImage(r: DesireRecord): boolean { return ["IMAGE", "CAROUSEL_ALBUM"].includes(r.media.type || "") && Boolean(r.media.url || r.media.thumbnail_url); }
export function enrichRecord(r: DesireRecord): DesireRecord {
  return { ...r, visual_analysis: r.visual_analysis || emptyVisual(), dream_object: extractDreamObject(r.source.original_text, r.visual_analysis) };
}
export function parseCorpus(value: unknown, max = 5000): DesireRecord[] {
  const list = Array.isArray(value) ? value : obj(value).records;
  if (!Array.isArray(list) || list.length > max) throw new Error(`Ожидается корпус до ${max} записей.`);
  const records = list.map((raw): DesireRecord => {
    const v=obj(raw), s=obj(v.source), m=obj(v.media), vis=obj(v.visual_analysis);
    if (typeof v.id !== "string" || !v.id || v.id.length > 300 || !["threads","bluesky"].includes(String(s.platform)) || typeof s.original_text !== "string") throw new Error("Некорректная запись корпуса.");
    let visual: VisualAnalysis = emptyVisual();
    if (vis.status === "analyzed") {
      const { status: _s, model_version: _m, ...output }=vis;
      visual = { ...parseVisualOutput(output), status:"analyzed", model_version:str(vis.model_version,100) };
    } else if (["not_analyzed","not_configured","failed"].includes(String(vis.status))) visual=emptyVisual(vis.status as VisualAnalysis["status"]);
    const text=str(s.original_text)!;
    return enrichRecord({
      id:v.id,
      source:{ platform:s.platform as "threads"|"bluesky", post_id:str(s.post_id,1000)||v.id, author_key:str(s.author_key,300), original_text:text, timestamp:str(s.timestamp,100), permalink:httpsUrl(s.permalink), queries:Array.isArray(s.queries)?s.queries.filter((x):x is string=>typeof x==='string').slice(0,40):[], collected_at:str(s.collected_at,100)||"" },
      media:{ type:str(m.type,40), url:httpsUrl(m.url), thumbnail_url:httpsUrl(m.thumbnail_url) },
      interpretation:detectDesire(text), place:{city:null,country:null,source:null},
      review:["keep","exclude"].includes(String(v.review))?v.review as "keep"|"exclude":"unreviewed", visual_analysis:visual,
    });
  });
  return mergeCorpus([],records);
}
