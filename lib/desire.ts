export const SEARCH_FORMULAS = ["я мечтаю", "хочу когда-нибудь", "I dream", "I wish", "хочу чтобы", "мне бы хотелось", "I hope", "I would love to"];
export type Review = "unreviewed" | "keep" | "exclude";
export type DesireRecord = {
  id: string;
  source: { platform: "threads"; post_id: string; original_text: string; timestamp: string | null; permalink: string | null; queries: string[]; collected_at: string };
  media: { type: string | null; url: string | null; thumbnail_url: string | null };
  interpretation: { method: "rules-v1"; candidate: boolean; modality: "dream" | "hope" | "want" | "longing" | null; matched_formula: string | null; language_hint: "ru" | "en" | "unknown"; requires_review: true };
  place: { city: null; country: null; source: null };
  review: Review;
};
const patterns: [RegExp, NonNullable<DesireRecord["interpretation"]["modality"]>][] = [
  [/мечта(?:ю|ем|ет|ешь|ют)|\bi dream(?: of| about)?\b/iu, "dream"],
  [/надеюсь|\bi hope\b/iu, "hope"],
  [/хотелось бы|мне бы хотелось|\bi wish\b|\bif only\b/iu, "longing"],
  [/хочу|хотим|\bi want\b|\bi would love to\b/iu, "want"],
];
export function detectDesire(text: string): DesireRecord["interpretation"] {
  const found = patterns.map(([pattern, modality]) => ({ match: text.match(pattern), modality })).find(x => x.match);
  return { method: "rules-v1", candidate: Boolean(found), modality: found?.modality ?? null, matched_formula: found?.match?.[0] ?? null, language_hint: /[а-яё]/iu.test(text) ? "ru" : /\b(?:i|wish|dream|want|hope)\b/iu.test(text) ? "en" : "unknown", requires_review: true };
}
export function mergeCorpus(existing: DesireRecord[], incoming: DesireRecord[]): DesireRecord[] {
  const map = new Map(existing.map(item => [item.id, item]));
  for (const item of incoming) {
    const previous = map.get(item.id);
    map.set(item.id, previous ? { ...previous, source: { ...previous.source, queries: [...new Set([...previous.source.queries, ...item.source.queries])] } } : item);
  }
  return [...map.values()];
}
