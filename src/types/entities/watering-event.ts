import { z } from "zod";
import { WateringSourceSchema } from "../enums";

export const WateringEventSchema = z.object({
  userFlowerId: z.string(),
  timestamp: z.string().datetime(),
  source: WateringSourceSchema,
  durationSeconds: z.number().int().min(0),
  moistureBeforePercent: z.number().min(0).max(100).nullable(),
  deviceId: z.string().nullable(),
  notes: z.string().nullable().default(null),
});

export type WateringEvent = z.infer<typeof WateringEventSchema>;
