import { z } from "zod";

/**
 * The subset of flower data sent to the AI as context.
 * Keeps the payload small while giving the model enough information
 * to answer care questions accurately.
 */
export const AiFlowerContextSchema = z.object({
  name: z.string(),
  scientificName: z.string(),
  careMantra: z.string(),
  wateringFrequencyDays: z.number(),
  wateringAmountMl: z.number(),
  wateringNotes: z.string(),
  sunlight: z.string(),
  idealPlacement: z.string(),
  placementTips: z.array(z.string()),
  temperatureMinC: z.number(),
  temperatureMaxC: z.number(),
  humidity: z.string(),
  humidityTip: z.string(),
  soilType: z.string(),
  repottingFrequencyYears: z.number(),
  repottingTip: z.string(),
  toxicityLabel: z.string(),
  allergyNotes: z.string(),
  isPetSafe: z.boolean(),
  isChildSafe: z.boolean(),
  scent: z.string(),
  scentDescription: z.string(),
  happySigns: z.array(z.string()),
  sadSigns: z.array(z.string()),
  interestingFacts: z.array(z.string()),
});

export type AiFlowerContext = z.infer<typeof AiFlowerContextSchema>;

export const AiAskRequestSchema = z.object({
  flowerId: z.string(),
  question: z.string().min(1).max(1000),
  flowerContext: AiFlowerContextSchema,
});

export type AiAskRequest = z.infer<typeof AiAskRequestSchema>;

export const AiAskResponseSchema = z.object({
  answer: z.string(),
  flowerId: z.string(),
});

export type AiAskResponse = z.infer<typeof AiAskResponseSchema>;
