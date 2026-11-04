import { detectDesire, type Agency, type DesireState } from "@/lib/desire";

export type ExpressionType =
  | "aspiration"
  | "sleep_dream"
  | "quote_lyrics"
  | "joke_meme"
  | "advertisement"
  | "news"
  | "third_person"
  | "legacy_retweet"
  | "ambiguous"
  | "other";

export type AspirationSubject = "self" | "other" | "collective" | "unknown";

export type DeepDesire =
  | "love_relationships"
  | "home_belonging"
  | "travel_exploration"
  | "career_self_realization"
  | "money_material_security"
  | "freedom_independence"
  | "creativity_expression"
  | "education_growth"
  | "family_children"
  | "health_wellbeing"
  | "recognition_status"
  | "community_justice"
  | "experience_pleasure"
  | "other"
  | "unknown";

const deepDesirePatterns: Array<[RegExp, DeepDesire]> = [
  [/(любов|отношен|партнер|партнёр|парень|девуш|свадьб|marry|marriage|love|relationship|partner|boyfriend|girlfriend|husband|wife)/iu, "love_relationships"],
  [/(дом|квартир|жиль|сво[йя]s+(?:дом|квартир)|home|house|apartment|housing|own place)/iu, "home_belonging"],
  [/(поех|путешеств|переех|эмигр|релокац|море|стран|travel|trip|visit|move to|moving|emigrat|relocat|world tour)/iu, "travel_exploration"],
  [/(работ|карьер|профес|бизнес|стартап|предприним|статьs+w+|job|career|business|startup|profession|become|photographer|singer|actor|actress)/iu, "career_self_realization"],
  [/(богат|деньг|доход|финанс|машин|купить|покуп|money|rich|wealth|financial|income|car|buy|owning)/iu, "money_material_security"],
  [/(свобод|независ|увол|уйти с работ|freedom|independen|quit|escape)/iu, "freedom_independence"],
  [/(рисов|музык|книг|писат|твор|искусств|играть на|music|write|book|art|creative|paint|piano|guitar)/iu, "creativity_expression"],
  [/(учить|учиться|образован|университет|экзамен|язык|learn|study|education|university|college|exam|language)/iu, "education_growth"],
  [/(семь|ребен|ребён|детей|родител|family|children|child|kids|parent)/iu, "family_children"],
  [/(здоров|тел[оа]|волос|похуд|менталь|wellbeing|well-being|health|body|hair|mental health)/iu, "health_wellbeing"],
  [/(извест|признан|успех|слава|кумир|встретитьs+w+|recognition|famous|success|meet .*idol|award)/iu, "recognition_status"],
  [/(мир|справедлив|войн|общество|права|justice|peace|society|community|rights|election)/iu, "community_justice"],
  [/(концерт|фестиваль|снег|вечерин|удовольств|concert|festival|party|snow|experience)/iu, "experience_pleasure"],
];

function expressionType(text: string): ExpressionType {
  if (/^rts*@/iu.test(text)) return "legacy_retweet";
  if (/(?:dreamt|dreamed|dreaming) last night|(?:in|from) my dream|мне приснил|сон приснил|приснилось/iu.test(text)) return "sleep_dream";
  if (/lyrics?|quote|цитат|стих|текст песни|song lyrics/iu.test(text)) return "quote_lyrics";
  if (/(?:sponsored|sale|discount|coupon|giveaway|offer)|скидк|промокод|реклам/iu.test(text)) return "advertisement";
  if (/(?:breaking|reports?|according to|news)|новост|сообщает|по данным/iu.test(text)) return "news";
  if (/(?:his|her|their) dream|его мечт|ее мечт|её мечт|их мечт/iu.test(text)) return "third_person";
  if (/мечт|dream|wish|hope|хочу|хотелось/iu.test(text)) return "aspiration";
  return "other";
}

function aspirationSubject(text: string): AspirationSubject {
  if (/(?:я|мне|мой|моя|мою|мы|нам|наш)|(?:i|me|my|mine|we|our)/iu.test(text)) return "self";
  if (/(?:мы|нам|наш|people|everyone|we|our|общество|люди|все)/iu.test(text)) return "collective";
  if (/(?:он|она|они|его|ее|её|их|he|she|they|his|her|their)/iu.test(text)) return "other";
  return "unknown";
}

function canonicalize(text: string) {
  return text
    .replace(/https?:\/\/\S+/giu, "")
    .replace(/@[A-Za-z0-9_]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

function inferDeepDesire(text: string): DeepDesire {
  for (const [pattern, label] of deepDesirePatterns) if (pattern.test(text)) return label;
  return /мечт|dream|wish|hope|хочу/iu.test(text) ? "other" : "unknown";
}

export function enrichDesireText(text: string) {
  const detected = detectDesire(text);
  const type = expressionType(text);
  const subject = aspirationSubject(text);
  const firstPerson = subject === "self" || subject === "collective";
  const isHumanAspiration =
    type === "aspiration" &&
    firstPerson &&
    !/^rt\s*@/iu.test(text);

  return {
    method: "heuristics-v1",
    is_human_aspiration: isHumanAspiration,
    expression_type: type,
    aspiration_subject: subject,
    surface_expression: text,
    canonical_desire: canonicalize(text),
    deep_desire: inferDeepDesire(text),
    lifecycle_state: detected.dream_state as DesireState,
    agency: detected.agency as Agency,
    duration_mentioned: detected.duration_mentioned,
    language_hint: detected.language_hint,
    confidence: isHumanAspiration ? 0.7 : type === "aspiration" ? 0.45 : 0.2,
    requires_review: true,
  };
}
