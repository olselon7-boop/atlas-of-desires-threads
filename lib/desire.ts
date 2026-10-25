export const SEARCH_FORMULAS = [
  "я мечтаю",
  "все еще мечтаю",
  "до сих пор мечтаю",
  "мечтаю, но не получается",
  "мечтаю, но не сбывается",
  "мечта сбылась",
  "мечта исполнилась",
  "исполнил мечту",
  "осуществил мечту",
  "реализовал мечту",
  "I dream",
  "still dreaming",
  "my dream came true",
  "I made my dream come true"
];

export type Review = "unreviewed" | "keep" | "exclude";
export type Platform = "threads" | "bluesky";
export type DesireState =
  | "dreaming"
  | "stalled"
  | "struggling"
  | "fulfilled_passive"
  | "fulfilled_active"
  | "abandoned"
  | "transformed"
  | "unknown";
export type Agency = "self" | "external" | "mixed" | "unknown";

export type DesireRecord = {
  id: string;
  source: {
    platform: Platform;
    post_id: string;
    author_key?: string | null;
    original_text: string;
    timestamp: string | null;
    permalink: string | null;
    queries: string[];
    collected_at: string;
  };
  media: { type: string | null; url: string | null; thumbnail_url: string | null };
  interpretation: {
    method: "rules-v2";
    candidate: boolean;
    modality: "dream" | "hope" | "want" | "longing" | null;
    dream_state: DesireState;
    agency: Agency;
    matched_formula: string | null;
    state_evidence: string | null;
    duration_mentioned: string | null;
    language_hint: "ru" | "en" | "unknown";
    requires_review: true;
  };
  place: { city: null; country: null; source: null };
  review: Review;
};

const modalityPatterns: [RegExp, NonNullable<DesireRecord["interpretation"]["modality"]>][] = [
  [/мечта(?:ю|ем|ет|ешь|ют|л|ла|ли)|\bi dream(?: of| about)?\b|\bdream(?:ed|ing)? of\b/iu, "dream"],
  [/надеюсь|\bi hope\b/iu, "hope"],
  [/хотелось бы|мне бы хотелось|\bi wish\b|\bif only\b/iu, "longing"],
  [/хочу|хотим|\bi want\b|\bi would love to\b/iu, "want"],
];

const statePatterns: [RegExp, DesireState, Agency][] = [
  [/(?:я\s+)?(?:исполнил(?:а)?|осуществил(?:а)?|реализовал(?:а)?)(?:\s+свою)?\s+мечт|\bi (?:made|turned) my dream (?:come true|into reality)\b|\bi (?:finally )?achieved my dream\b/iu, "fulfilled_active", "self"],
  [/мечт[аы]\s+(?:сбылась|сбылись|исполнилась|исполнились)|\bmy dream(?:s)? (?:came|has come|have come) true\b/iu, "fulfilled_passive", "external"],
  [/(?:мечтаю|мечтаем).{0,80}(?:но|а).{0,80}(?:не сбыва|не получа|ничего не происход|не двига)|\bstill dream(?:ing)?\b.{0,80}\b(?:but|and)\b.{0,80}\b(?:nothing|not happening|no progress)\b/iu, "stalled", "unknown"],
  [/(?:пытаюсь|стараюсь|работаю над).{0,80}(?:мечт|цель)|\b(?:trying|working) (?:to|toward|towards).{0,80}\bdream\b/iu, "struggling", "self"],
  [/(?:перестал(?:а)? мечтать|отказал(?:ся|ась) от мечты|мечта больше не)|\b(?:gave up on|no longer have|stopped chasing) my dream\b/iu, "abandoned", "self"],
  [/(?:мечта изменилась|теперь мечтаю о|раньше мечтал(?:а)? о)|\bmy dream (?:changed|has changed)\b|\bi used to dream of\b/iu, "transformed", "mixed"],
  [/(?:мечтаю|мечтаем|мечтает)|\bi dream(?: of| about)?\b|\bdreaming of\b/iu, "dreaming", "unknown"],
];

const durationPattern = /\b\d+(?:[.,]\d+)?\s*(?:лет|года|год|месяц(?:а|ев)?|недел(?:я|и|ь)|дн(?:я|ей)|years?|months?|weeks?|days?)\b/iu;

export function detectDesire(text: string): DesireRecord["interpretation"] {
  const modalityFound = modalityPatterns
    .map(([pattern, modality]) => ({ match: text.match(pattern), modality }))
    .find(x => x.match);
  const stateFound = statePatterns
    .map(([pattern, state, agency]) => ({ match: text.match(pattern), state, agency }))
    .find(x => x.match);
  const duration = text.match(durationPattern)?.[0] ?? null;
  const candidate = Boolean(modalityFound || stateFound);

  return {
    method: "rules-v2",
    candidate,
    modality: modalityFound?.modality ?? (stateFound ? "dream" : null),
    dream_state: stateFound?.state ?? "unknown",
    agency: stateFound?.agency ?? "unknown",
    matched_formula: modalityFound?.match?.[0] ?? stateFound?.match?.[0] ?? null,
    state_evidence: stateFound?.match?.[0] ?? null,
    duration_mentioned: duration,
    language_hint: /[а-яё]/iu.test(text) ? "ru" : /\b(?:i|wish|dream|want|hope|my)\b/iu.test(text) ? "en" : "unknown",
    requires_review: true,
  };
}

export function mergeCorpus(existing: DesireRecord[], incoming: DesireRecord[]): DesireRecord[] {
  const map = new Map(existing.map(item => [item.id, item]));
  for (const item of incoming) {
    const previous = map.get(item.id);
    map.set(
      item.id,
      previous
        ? {
            ...previous,
            source: {
              ...previous.source,
              queries: [...new Set([...previous.source.queries, ...item.source.queries])],
            },
          }
        : item,
    );
  }
  return [...map.values()];
}
