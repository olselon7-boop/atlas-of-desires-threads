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
  | "sex_intimacy"
  | "other"
  | "unknown";

const deepDesirePatterns: Array<[RegExp, DeepDesire]> = [
  [/(?:секс|интим|эрот|проституц|sexual|intimacy|erotic|prostitut)/iu, "sex_intimacy"],
  [/(?:\$\s*\d|\d+(?:[.,]\d+)?\s*(?:доллар|рубл|евро|pound|usd|eur)|цена|стоимост|деньг|богат|доход|финанс|зарплат|бюджет|машин|автомобил|купить|покуп|бензин|топлив|галлон|литр|price|cost|money|rich|wealth|financial|income|salary|budget|buy|buying|gas(?:oline)?|fuel|gallon)/iu, "money_material_security"],
  [/(любов|отношен|партнер|партнёр|парень|девуш|свадьб|marry|marriage|love|relationship|partner|boyfriend|girlfriend|husband|wife)/iu, "love_relationships"],
  [/(дом|квартир|жиль|сво[йя]\s+(?:дом|квартир)|home|house|apartment|housing|own place)/iu, "home_belonging"],
  [/(поех|путешеств|переех|эмигр|релокац|море|стран|travel|trip|visit|move to|moving|emigrat|relocat|world tour)/iu, "travel_exploration"],
  [/(работ|карьер|профес|бизнес|стартап|предприним|job|career|business|startup|profession|become|photographer|singer|actor|actress)/iu, "career_self_realization"],
  [/(свобод|независ|увол|уйти с работ|freedom|independen|quit|escape)/iu, "freedom_independence"],
  [/(рисов|музык|книг|писат|твор|искусств|играть на|music|write|book|art|creative|paint|piano|guitar)/iu, "creativity_expression"],
  [/(учить|учиться|образован|университет|экзамен|язык|learn|study|education|university|college|exam|language)/iu, "education_growth"],
  [/(семь|ребен|ребён|детей|родител|family|children|child|kids|parent)/iu, "family_children"],
  [/(здоров|тел[оа]|волос|похуд|менталь|wellbeing|well-being|health|body|hair|mental health)/iu, "health_wellbeing"],
  [/(извест|признан|успех|слава|кумир|recognition|famous|success|meet .*idol|award)/iu, "recognition_status"],
  [/(мир|справедлив|войн|общество|права|justice|peace|society|community|rights|election)/iu, "community_justice"],
  [/(концерт|фестиваль|снег|вечерин|удовольств|concert|festival|party|snow|experience)/iu, "experience_pleasure"],
];

function expressionType(text: string): ExpressionType {
  if (/^rt\s*@/iu.test(text)) return "legacy_retweet";
  if (/(?:dreamt|dreamed|dreaming) last night|(?:in|from) my dream|i (?:keep )?dream(?:ed|t|ing)? about|i dream about him|i dream about her|while i sleep|when i sleep|sleep to .*dream|dream every night|nightmare|daymare|мне приснил|сон приснил|приснилось|снилось|мне снится|мне снился|мне снилась|вижу во сне|сон про|сны про|сны о/iu.test(text)) return "sleep_dream";
  if (/(?:lyrics?|quote)|цитат|стих|текст песни|song lyrics/iu.test(text)) return "quote_lyrics";
  if (/(?:sponsored|sale|discount|coupon|giveaway|offer)|скидк|промокод|реклам/iu.test(text)) return "advertisement";
  if (/(?:breaking|reports?|according to|news)|новост|сообщает|по данным/iu.test(text)) return "news";
  if (/(?:his|her|their) dream|его мечт|ее мечт|её мечт|их мечт/iu.test(text)) return "third_person";
  if (
    /(?:please|kindly|help me|support me|support my|donat(?:e|ing)|campaign|fund my|requesting for help|i am writing to you|dear (?:mr\.?|sir)|hello (?:mr\.?|sir)|@elonmusk|@elonmuskaoc|@elonmuskpd)/iu.test(text) ||
    /(?:помогите|прошу помочь|поддержите|сбор средств|донат|кампания|обращаюсь к|уважаемый)/iu.test(text)
  ) return "other";
  if (/мечт|dream|wish|hope|хочу|хотелось/iu.test(text)) return "aspiration";
  return "other";
}

function aspirationSubject(text: string): AspirationSubject {
  const t = " " + text.toLowerCase().replace(/[^a-zа-яё0-9_]+/giu, " ") + " ";
  if (/\s(?:я|мне|мой|моя|моё|мою|мои|мы|нам|наш|наша|наше|наши|i|me|my|mine|we|our)\s/iu.test(t)) return "self";
  if (/(?:^|\s)(?:мечтаю|мечтал|мечтала|хочу|хотел|хотела|dreaming|dreamed)(?:\s|$)/iu.test(t)) return "self";
  if (/\s(?:люди|все|общество|people|everyone)\s/iu.test(t)) return "collective";
  if (/\s(?:он|она|они|его|ее|её|их|he|she|they|his|her|their)\s/iu.test(t)) return "other";
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
  const lower=text.toLowerCase();
  const explicitSexStem=String.fromCharCode(1096,1083,1102,1093);
  if (lower.includes(explicitSexStem)) return "sex_intimacy";
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
    !/(?:sleep|asleep|nightmare|daymare|every night|while i sleep|when i sleep|во сне|приснил|приснилось|снилось|мне снится|сон про|сны про|сны о)/iu.test(text) &&
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
