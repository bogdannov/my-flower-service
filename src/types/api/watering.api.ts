import { z } from "zod";
import { WateringSourceSchema } from "../enums";

export const CreateWateringEventRequestSchema = z.object({
  durationSeconds: z.number().int().min(0).default(0),
});

export type CreateWateringEventRequest = z.infer<typeof CreateWateringEventRequestSchema>;

// Used by DeviceService (Phase 4) — included here as single source of truth
export const DeviceSubmitWateringRequestSchema = z.object({
  source: WateringSourceSchema,
  durationSeconds: z.number().int().min(0),
  moistureBeforePercent: z.number().min(0).max(100).nullable(),
  timestamp: z.string().datetime(),
});

export type DeviceSubmitWateringRequest = z.infer<typeof DeviceSubmitWateringRequestSchema>;

export const WateringEventResponseSchema = z.object({
  userFlowerId: z.string(),
  timestamp: z.string().datetime(),
  source: WateringSourceSchema,
  durationSeconds: z.number().int().min(0),
  moistureBeforePercent: z.number().min(0).max(100).nullable(),
  deviceId: z.string().nullable(),
});

export type WateringEventResponse = z.infer<typeof WateringEventResponseSchema>;

export const WateringHistoryResponseSchema = z.object({
  items: z.array(WateringEventResponseSchema),
  nextCursor: z.string().nullable(),
});

export type WateringHistoryResponse = z.infer<typeof WateringHistoryResponseSchema>;
