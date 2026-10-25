import type { DesireRecord, DesireState } from "../desire.ts";
import { extractDreamObject } from "../dream-object.ts";
import { hasImage, httpsUrl } from "../corpus.ts";
import { linkTrajectories, trajectoryIsConfirmed, type TrajectoryReview } from "../trajectory.ts";
export type DesireObject = { id:string; text:string; date:string|null; language:string; state:DesireState; dream_object:string|null; platform:"threads"|"bluesky"; image:string|null; visual_withheld:boolean; persistence:number|null };
export type AtlasTrajectory = { id:string; points:{id:string;state:DesireState;date:string|null}[]; elapsed_days:number|null; time_to_fulfillment:number|null; reviewed:true };
export interface AtlasDataSource {
  getDesires():Promise<DesireObject[]>;
  getTrajectories():Promise<AtlasTrajectory[]>;
}
// Opaque artwork IDs are recomputed; research identifiers are never serialized.
export function artworkId(id:string):string {
  let a=2166136261,b=2246822507;
  for(const c of id){a=Math.imul(a^c.charCodeAt(0),16777619);b=Math.imul(b^c.charCodeAt(0),3266489909);}
  return `d_${(a>>>0).toString(36)}${(b>>>0).toString(36)}`;
}
export function publicText(text:string):string {
  return text.replace(/(?:[a-z0-9-]+\.)+(?:com|net|org|ru|app|social|me|io|tv)\/[^\s]+/giu,"[source]").replace(/https?:\/\/\S+|at:\/\/\S+|did:[^\s]+/giu,"[source]").replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g,"[contact]").replace(/@[\p{L}\p{N}_.-]+/gu,"[person]").replace(/(?<!\w)\+?\d[\d ()-]{7,}\d/g,"[contact]");
}
export function publicImage(r:DesireRecord):string|null {
  const v=r.visual_analysis;
  if(!hasImage(r)||v?.status!=="analyzed"||v.contains_people!==false||v.contains_readable_text!==false||v.confidence===null||v.confidence<.7) return null;
  const link=httpsUrl(r.media.thumbnail_url||r.media.url);
  if(!link)return null;
  const host=new URL(link).hostname;
  // Known image CDNs only; don't load author-profile URLs into the artwork.
  return host==='cdn.bsky.app'||host.endsWith('.fbcdn.net')||host.endsWith('.cdninstagram.com')?link:null;
}
export function sanitizeDesire(r:DesireRecord):DesireObject {
  const label=extractDreamObject(r.source.original_text,r.visual_analysis).canonical;
  const image=publicImage(r);
  return {id:artworkId(r.id),text:publicText(r.source.original_text),date:r.source.timestamp?.slice(0,10)||null,language:r.interpretation.language_hint,state:r.interpretation.dream_state,dream_object:label&&/^[a-z][a-z0-9_]{1,80}$/.test(label)?label:null,platform:r.source.platform,image,visual_withheld:hasImage(r)&&!image,persistence:null};
}
export class CorpusDataSource implements AtlasDataSource {
  private readonly records:DesireRecord[];
  private readonly reviews:Record<string,TrajectoryReview>;
  constructor(records:DesireRecord[],reviews:Record<string,TrajectoryReview>={}){this.records=records;this.reviews=reviews;}
  async getDesires(){return this.records.filter(r=>r.review!=="exclude"&&r.interpretation.candidate).map(sanitizeDesire);}
  async getTrajectories():Promise<AtlasTrajectory[]>{
    return linkTrajectories(this.records,this.reviews).filter(trajectoryIsConfirmed).map(t=>({id:artworkId(t.id),points:[t.before,t.after].map(r=>({id:artworkId(r.id),state:r.interpretation.dream_state,date:r.source.timestamp?.slice(0,10)||null})),elapsed_days:t.elapsed_days,time_to_fulfillment:t.time_to_fulfillment,reviewed:true}));
  }
}
