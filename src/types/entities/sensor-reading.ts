import { z } from "zod";

export const SensorReadingSchema = z.object({
  userFlowerId: z.string(),
  timestamp: z.string().datetime(),
  moisturePercent: z.number().min(0).max(100),
  rawValue: z.number().int(),
  deviceId: z.string(),
  ttl: z.number().int(),
});

export type SensorReading = z.infer<typeof SensorReadingSchema>;
