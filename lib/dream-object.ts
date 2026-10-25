import type { VisualAnalysis } from "./visual-schema.ts";
export type DreamObject = { canonical: string | null; text_evidence: string[]; visual_evidence: string[]; confidence: number; method: string };
// Match roots explicitly: JS \b does not mark Cyrillic word boundaries.
const patterns: [string, RegExp][] = [
  ["body_change", /(?:подколоть|увелич\S*|накач\S*|сдела\S*).{0,25}губ|lip (?:filler|augmentation)|\b(?:lose weight|body transformation)\b|похудеть/iu],
  ["publish_book", /изда\S*.{0,25}(?:книг|роман)|опубликов\S*.{0,25}(?:книг|роман)|\bpublish(?:ing)? (?:my |a )?book\b/iu],
  ["find_book", /(?:нашла|нашёл|нашел|найти).{0,45}(?:роман|книг)|\b(?:found|find) (?:the |a )?book\b/iu],
  ["travel_to_sea", /мор[еяю]|морем|морском|океан\S*|побереж\S*|\b(?:sea|ocean|seaside|beach)\b/iu],
  ["own_home", /(?:сво\S*|куп\S*|постро\S*).{0,25}(?:дом|квартир)|\b(?:own|buy|build) (?:my |a |our )?(?:home|house|apartment)\b/iu],
  ["move_to_another_country", /переех\S*.{0,25}(?:стран|границ)|эмигр\S*|\b(?:move|moving) (?:abroad|to another country)\b/iu],
  ["career_change", /смен\S*.{0,20}(?:работ|професс)|\b(?:change|changing) (?:my )?career\b/iu],
  ["become_artist", /ста\S*.{0,20}худож\S*|\bbecom(?:e|ing) an? artist\b/iu],
  ["wedding", /свадьб\S*|замуж|жениться|\b(?:wedding|marry|married)\b/iu],
  ["have_children", /роди\S*.{0,20}(?:реб[её]н|дет)|\bhave (?:a baby|children|kids)\b/iu],
  ["financial_independence", /финансов\S*.{0,20}(?:свобод|независ)|\bfinancial (?:freedom|independence)\b/iu],
  ["education", /поступ\S*.{0,25}(?:универс|вуз)|диплом\S*|\b(?:university|graduate|degree)\b/iu],
  ["open_business", /откры\S*.{0,25}(?:бизнес|магазин|кафе)|\b(?:open|start) (?:my |a )?(?:business|shop|cafe)\b/iu],
  ["peace", /(?:^|\s)мир(?:а|е|у)?(?:\s|[.!?,]|$)|\bpeace\b/iu],
  ["relationship", /любов\S*|любим\S*.{0,15}человек|\b(?:love|relationship|soulmate)\b/iu],
];
export function extractDreamObject(text: string, visual?: VisualAnalysis): DreamObject {
  const matches = patterns.flatMap(([canonical, pattern]) => { const m = text.match(pattern); return m ? [{ canonical, evidence: m[0] }] : []; });
  const canonical = matches.length === 1 ? matches[0].canonical : null;
  const usableVisual = visual?.status === "analyzed" && visual.confidence !== null && visual.confidence >= .7 && ["high", "medium"].includes(visual.text_image_alignment) && !["unknown", "unrelated", "metaphor"].includes(visual.visual_role);
  const visualLabel = usableVisual ? visual.dream_object_visual : null;
  const conflict = Boolean(canonical && visualLabel && canonical !== visualLabel);
  return {
    canonical: canonical || (matches.length === 0 ? visualLabel || null : null),
    text_evidence: matches.map(m => m.evidence),
    visual_evidence: usableVisual ? [visual.description, visualLabel].filter((s): s is string => Boolean(s)) : [],
    confidence: conflict ? .4 : canonical ? .85 : visualLabel ? Math.min(.8, visual?.confidence || 0) : 0,
    method: matches.length > 1 ? "ambiguous-multiple-objects-v1" : conflict ? "text-visual-conflict-v1" : visualLabel && !canonical ? "visual-supported-v1" : "text-rules-v1",
  };
}
