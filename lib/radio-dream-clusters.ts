import type { DeepDesire } from "@/lib/desire-enrichment";

export type RadioDreamCluster =
  | "love_relationships"
  | "sex_intimacy"
  | "career_self_realization"
  | "money_material_security"
  | "freedom_independence"
  | "health_wellbeing"
  | "community_justice";

const RADIO_CLUSTER_MAP: Record<DeepDesire, RadioDreamCluster | null> = {
  love_relationships: "love_relationships",
  family_children: "love_relationships",

  sex_intimacy: "sex_intimacy",

  career_self_realization: "career_self_realization",
  creativity_expression: "career_self_realization",
  education_growth: "career_self_realization",
  recognition_status: "career_self_realization",

  money_material_security: "money_material_security",
  home_belonging: "money_material_security",

  freedom_independence: "freedom_independence",
  travel_exploration: "freedom_independence",

  health_wellbeing: "health_wellbeing",
  happiness: "health_wellbeing",
  experience_pleasure: "health_wellbeing",

  community_justice: "community_justice",

  other: null,
  unknown: null
};

export function toRadioDreamCluster(value: unknown): RadioDreamCluster | null {
  const key = String(value || "") as DeepDesire;
  return RADIO_CLUSTER_MAP[key] ?? null;
}
