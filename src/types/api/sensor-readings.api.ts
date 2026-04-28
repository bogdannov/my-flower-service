import { z } from "zod";

export const GetSensorReadingsQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
  exclusiveStartKey: z.string().optional(),
});

export type GetSensorReadingsQuery = z.infer<typeof GetSensorReadingsQuerySchema>;

export const SensorReadingResponseSchema = z.object({
  userFlowerId: z.string(),
  timestamp: z.string().datetime(),
  moisturePercent: z.number().min(0).max(100),
  rawValue: z.number().int(),
  deviceId: z.string(),
});

export type SensorReadingResponse = z.infer<typeof SensorReadingResponseSchema>;

export const SensorReadingsListResponseSchema = z.object({
  items: z.array(SensorReadingResponseSchema),
  nextCursor: z.string().nullable(),
});

export type SensorReadingsListResponse = z.infer<typeof SensorReadingsListResponseSchema>;
