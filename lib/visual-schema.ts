export const VISUAL_ROLES = ["object_of_dream", "evidence_of_fulfillment", "aspirational_reference", "memory", "metaphor", "unrelated", "unknown"] as const;
export type VisualRole = typeof VISUAL_ROLES[number];
export type VisualAnalysis = {
  status: "not_analyzed" | "not_configured" | "analyzed" | "failed";
  model_version: string | null;
  visual_motifs: string[];
  objects: string[];
  scene_type: string | null;
  mood: string[];
  visual_role: VisualRole;
  dream_object_visual: string | null;
  text_image_alignment: "high" | "medium" | "low" | "unknown";
  contains_people: boolean | null;
  contains_readable_text: boolean | null;
  description: string | null;
  confidence: number | null;
};
export function emptyVisual(status: VisualAnalysis["status"] = "not_analyzed"): VisualAnalysis {
  return { status, model_version: null, visual_motifs: [], objects: [], scene_type: null, mood: [], visual_role: "unknown", dream_object_visual: null, text_image_alignment: "unknown", contains_people: null, contains_readable_text: null, description: null, confidence: null };
}
const nullableText = { type: ["string", "null"] };
const strings = { type: "array", items: { type: "string" } };
export const visualOutputSchema = {
  type: "object", additionalProperties: false,
  properties: {
    visual_motifs: strings, objects: strings, scene_type: nullableText, mood: strings,
    visual_role: { type: "string", enum: [...VISUAL_ROLES] }, dream_object_visual: nullableText,
    text_image_alignment: { type: "string", enum: ["high", "medium", "low", "unknown"] },
    contains_people: { type: ["boolean", "null"] }, contains_readable_text: { type: ["boolean", "null"] },
    description: nullableText, confidence: { type: ["number", "null"], minimum: 0, maximum: 1 },
  },
  required: ["visual_motifs", "objects", "scene_type", "mood", "visual_role", "dream_object_visual", "text_image_alignment", "contains_people", "contains_readable_text", "description", "confidence"],
};
export function parseVisualOutput(value: unknown): Omit<VisualAnalysis, "status" | "model_version"> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid visual analysis object");
  const v = value as Record<string, unknown>;
  const keys = visualOutputSchema.required;
  if (Object.keys(v).some(k => !keys.includes(k)) || keys.some(k => !(k in v))) throw new Error("Invalid visual analysis fields");
  for (const k of ["visual_motifs", "objects", "mood"]) {
    if (!Array.isArray(v[k]) || v[k].length > 40 || v[k].some((s: unknown) => typeof s !== "string" || s.length > 300)) throw new Error("Invalid visual array");
  }
  for (const k of ["scene_type", "dream_object_visual", "description"]) {
    if (v[k] !== null && (typeof v[k] !== "string" || (v[k] as string).length > 2000)) throw new Error("Invalid visual text");
  }
  for (const k of ["contains_people", "contains_readable_text"]) if (v[k] !== null && typeof v[k] !== "boolean") throw new Error("Invalid visual flag");
  if (!VISUAL_ROLES.includes(v.visual_role as VisualRole) || !["high", "medium", "low", "unknown"].includes(String(v.text_image_alignment))) throw new Error("Invalid visual enum");
  if (v.confidence !== null && (typeof v.confidence !== "number" || !Number.isFinite(v.confidence) || v.confidence < 0 || v.confidence > 1)) throw new Error("Invalid visual confidence");
  return Object.fromEntries(keys.map(k => [k, v[k]])) as Omit<VisualAnalysis, "status" | "model_version">;
}
