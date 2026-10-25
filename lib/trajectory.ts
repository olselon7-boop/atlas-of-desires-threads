import type { DesireRecord, DesireState } from "./desire.ts";
import { extractDreamObject } from "./dream-object.ts";
export type SameDream = {
  confidence: number;
  verdict: "confirmed_candidate" | "possible" | "different_dream" | "insufficient_evidence";
  shared_dream_object: string | null;
  evidence: { text: string[]; visual: string[]; temporal: string[] };
  requires_manual_review: true;
};
export type TrajectoryReview = "same_dream" | "different_dream" | "insufficient_evidence";
export type DreamTrajectory = {
  id: string; before: DesireRecord; after: DesireRecord; same_dream: SameDream;
  elapsed_days: number | null; time_to_fulfillment: number | null;
  manual_review?: TrajectoryReview;
};
const pursuing: DesireState[] = ["dreaming", "stalled", "struggling"];
const fulfilled: DesireState[] = ["fulfilled_active", "fulfilled_passive"];
export function isFirstPerson(text: string): boolean {
  if (/^[«“"]|\b(?:he|she|they) (?:said|says)\b|(?:он|она|они) (?:говорит|сказал|сказала)/iu.test(text.trim())) return false;
  return /(?:^|[^\p{L}])(?:я|моя|мою|моей|мечтаю|мечтала|мечтал|хочу|нашла|наш[её]л|осуществила|осуществил)(?!\p{L})|\b(?:i|my|mine)\b/iu.test(text);
}
// Entities are explicit words in the post, never inferred geography or author metadata.
const entityPatterns: [string, RegExp][] = [
  ["japan", /япони\S*|\bjapan(?:ese)?\b/iu], ["italy", /итали\S*|\bitaly\b/iu],
  ["turkey", /турци\S*|\bturkey\b/iu], ["spain", /испани\S*|\bspain\b/iu],
  ["france", /франци\S*|\bfrance\b/iu], ["bali", /(?:^|\s)бали(?:\s|$)|\bbali\b/iu],
];
function explicitEntities(text: string): string[] { return entityPatterns.filter(([,pattern])=>pattern.test(text)).map(([label])=>label); }
export function compareDreams(before: DesireRecord, after: DesireRecord): DreamTrajectory {
  const a = extractDreamObject(before.source.original_text, before.visual_analysis);
  const b = extractDreamObject(after.source.original_text, after.visual_analysis);
  const t1 = Date.parse(before.source.timestamp || ""), t2 = Date.parse(after.source.timestamp || "");
  const elapsed = Number.isFinite(t1) && Number.isFinite(t2) && t2 > t1 ? (t2 - t1) / 86400000 : null;
  const shared = a.canonical && a.canonical === b.canonical ? a.canonical : null;
  const entitiesA=explicitEntities(before.source.original_text), entitiesB=explicitEntities(after.source.original_text);
  const entityConflict=entitiesA.length>0&&entitiesB.length>0&&!entitiesA.some(e=>entitiesB.includes(e));
  const evidence: SameDream["evidence"] = { text: [], visual: [], temporal: [] };
  let verdict: SameDream["verdict"] = "insufficient_evidence", confidence = .1;
  const sameAuthor = Boolean(before.source.author_key && before.source.author_key === after.source.author_key && before.source.platform === after.source.platform);
  const firstPerson = isFirstPerson(before.source.original_text) && isFirstPerson(after.source.original_text);
  const chronological = elapsed !== null;
  if (entityConflict || (a.canonical && b.canonical && a.canonical !== b.canonical)) {
    verdict = "different_dream"; confidence = .95; evidence.text.push(entityConflict?`Разные явно названные контексты: ${entitiesA.join(", ")} / ${entitiesB.join(", ")}`:`Разные объекты: ${a.canonical} / ${b.canonical}`);
  } else if (sameAuthor && chronological && firstPerson && shared && Math.min(a.confidence, b.confidence) >= .7) {
    const sa = before.interpretation.dream_state, sb = after.interpretation.dream_state;
    const compatible = pursuing.includes(sa) && (pursuing.includes(sb) || fulfilled.includes(sb) || ["abandoned", "transformed"].includes(sb));
    verdict = compatible ? "confirmed_candidate" : "possible";
    confidence = compatible ? .82 : .55;
    evidence.text.push(`Общий объект: ${shared}`, "Оба высказывания от первого лица", ...a.text_evidence, ...b.text_evidence);
    if (elapsed > 3650) { verdict = "possible"; confidence = .55; evidence.temporal.push("Большой интервал: требуется дополнительный контекст"); }
  }
  if (shared && !entityConflict) evidence.text.push(...entitiesA.filter(e=>entitiesB.includes(e)).map(e=>`Общая явная сущность в тексте: ${e}`));
  if (!sameAuthor) evidence.text.push("Нет подтверждённого общего псевдонима автора и платформы");
  if (!firstPerson) evidence.text.push("Первое лицо не подтверждено в обоих высказываниях");
  if (!a.canonical || !b.canonical) evidence.text.push("Объект одной или обеих мечтаний не установлен однозначно");
  if (chronological) evidence.temporal.push(`Порядок наблюдений подтверждён; интервал ${elapsed.toFixed(1)} дней`);
  else evidence.temporal.push("Нет двух разных дат в хронологическом порядке");
  const va = before.visual_analysis, vb = after.visual_analysis;
  if (va?.status === "analyzed" && vb?.status === "analyzed") {
    const common = va.objects.filter(x => vb.objects.includes(x));
    evidence.visual.push(...common.map(x => `Общий видимый объект: ${x}`));
    if (va.scene_type && va.scene_type === vb.scene_type) evidence.visual.push(`Общая сцена: ${va.scene_type}`);
    if (vb.visual_role === "evidence_of_fulfillment") evidence.visual.push("Позднее изображение согласуется с исполнением; это не доказательство само по себе");
    if (shared && common.length && verdict === "confirmed_candidate") confidence = .88;
  }
  const same_dream: SameDream = { confidence, verdict, shared_dream_object: shared, evidence, requires_manual_review: true };
  const duration = verdict === "confirmed_candidate" && pursuing.includes(before.interpretation.dream_state) && fulfilled.includes(after.interpretation.dream_state) ? elapsed : null;
  return { id: `${before.id}:${after.id}`, before, after, same_dream, elapsed_days: elapsed, time_to_fulfillment: duration };
}
export function applyTrajectoryReview(pair: DreamTrajectory, review?: TrajectoryReview): DreamTrajectory {
  if (!review) return pair;
  const canMeasure = review === "same_dream" && pair.same_dream.verdict === "confirmed_candidate" && pursuing.includes(pair.before.interpretation.dream_state) && fulfilled.includes(pair.after.interpretation.dream_state);
  return { ...pair, manual_review: review, time_to_fulfillment: canMeasure ? pair.elapsed_days : null };
}
export function trajectoryIsConfirmed(pair: DreamTrajectory): boolean { return pair.manual_review === "same_dream"; }
export function linkTrajectories(records: DesireRecord[], reviews: Record<string, TrajectoryReview> = {}): DreamTrajectory[] {
  const groups = new Map<string, DesireRecord[]>();
  for (const r of records) {
    if (!r.source.author_key || r.review === "exclude" || !r.interpretation.candidate) continue;
    const key = `${r.source.platform}:${r.source.author_key}`;
    groups.set(key, [...(groups.get(key) || []), r]);
  }
  const pairs: DreamTrajectory[] = [];
  for (const group of groups.values()) {
    const ordered = group.filter(r => Number.isFinite(Date.parse(r.source.timestamp || ""))).sort((a,b) => Date.parse(a.source.timestamp!) - Date.parse(b.source.timestamp!)).slice(-60);
    for (let i=0; i<ordered.length; i++) for (let j=i+1; j<ordered.length; j++) {
      const pair = compareDreams(ordered[i], ordered[j]);
      pairs.push(applyTrajectoryReview(pair, reviews[pair.id]));
      if (pairs.length >= 1000) return pairs;
    }
  }
  return pairs.sort((a,b) => b.same_dream.confidence - a.same_dream.confidence);
}
