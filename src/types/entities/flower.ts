import { z } from "zod";

// ── Union type schemas ──

export const SunlightLevelSchema = z.enum(["full_sun", "partial_shade", "full_shade"]);
export type SunlightLevel = z.infer<typeof SunlightLevelSchema>;

export const ImportanceLevelSchema = z.enum(["critical", "important", "flexible"]);
export type ImportanceLevel = z.infer<typeof ImportanceLevelSchema>;

export const HumidityLevelSchema = z.enum(["low", "medium", "high"]);
export type HumidityLevel = z.infer<typeof HumidityLevelSchema>;

export const GrowthSpeedSchema = z.enum(["slow", "moderate", "fast"]);
export type GrowthSpeed = z.infer<typeof GrowthSpeedSchema>;

export const ToxicityLevelSchema = z.enum(["non_toxic", "mildly_toxic", "toxic"]);
export type ToxicityLevel = z.infer<typeof ToxicityLevelSchema>;

export const ScentLevelSchema = z.enum(["none", "mild", "moderate", "strong"]);
export type ScentLevel = z.infer<typeof ScentLevelSchema>;

export const DifficultyLevelSchema = z.enum(["beginner", "intermediate", "expert"]);
export type DifficultyLevel = z.infer<typeof DifficultyLevelSchema>;

// ── Sub-object schemas ──

export const DifficultyBadgeSchema = z.object({
  /** Emoji icon, e.g. "🌱" / "🌿" / "🌳" */
  emoji: z.string(),
  /** Short label shown next to the emoji, e.g. "Easy" */
  label: z.string(),
});
export type DifficultyBadge = z.infer<typeof DifficultyBadgeSchema>;

// ── Main entity ──

/**
 * A read-only flower catalog entry (species-level data).
 * This is NOT the same as UserFlower — a Flower is a shared species template;
 * a UserFlower is a user's owned plant instance that optionally references a Flower.
 */
export const FlowerSchema = z.object({
  // Identity
  id: z.string(),
  name: z.string(),
  flowerUserName: z.string(),
  scientificName: z.string(),
  category: z.string(),
  imageUrl: z.string(),
  shortDescription: z.string(),
  fullDescription: z.string(),

  // Child-friendly care
  flowerNotes: z.string(),
  careMantra: z.string(),
  difficultyBadge: DifficultyBadgeSchema,

  // Watering
  wateringFrequencyDays: z.number(),
  wateringAmountMl: z.number(),
  wateringNotes: z.string(),

  // Light & Placement
  sunlight: SunlightLevelSchema,
  sunlightImportance: ImportanceLevelSchema,
  idealPlacement: z.string(),
  placementTips: z.array(z.string()),

  // Environment
  temperatureMinC: z.number(),
  temperatureMaxC: z.number(),
  humidity: HumidityLevelSchema,
  humidityTip: z.string(),

  // Growth & Maintenance
  growthSpeed: GrowthSpeedSchema,
  soilType: z.string(),
  repottingFrequencyYears: z.number(),
  repottingTip: z.string(),

  // Safety
  toxicity: ToxicityLevelSchema,
  toxicityLabel: z.string(),
  isAllergyRisk: z.boolean(),
  allergyNotes: z.string(),
  isPetSafe: z.boolean(),
  isChildSafe: z.boolean(),

  // Sensory
  scent: ScentLevelSchema,
  scentDescription: z.string(),

  // Health signals
  happySigns: z.array(z.string()),
  sadSigns: z.array(z.string()),

  // Fun
  interestingFacts: z.array(z.string()),

  // Meta
  origin: z.string(),
  bloomSeason: z.string(),
  difficulty: DifficultyLevelSchema,
});

export type Flower = z.infer<typeof FlowerSchema>;
