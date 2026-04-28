import { z } from "zod";
import { WateringSettingsSchema } from "../entities/user-flower";
import { PendingCommandSchema, WateringSourceSchema } from "../enums";

// ── Pairing ──

export const DevicePairRequestSchema = z.object({
  deviceId: z.string().min(1),
  code: z.string().length(6),
});

export type DevicePairRequest = z.infer<typeof DevicePairRequestSchema>;

export const DevicePairResponseSchema = z.object({
  apiKey: z.string(),
  userFlowerId: z.string(),
  settings: WateringSettingsSchema,
});

export type DevicePairResponse = z.infer<typeof DevicePairResponseSchema>;

export const GeneratePairingCodeResponseSchema = z.object({
  code: z.string(),
  expiresAt: z.string().datetime(),
});

export type GeneratePairingCodeResponse = z.infer<typeof GeneratePairingCodeResponseSchema>;

// ── Device submissions ──

export const DeviceSubmitReadingRequestSchema = z.object({
  moisturePercent: z.number().min(0).max(100),
  rawValue: z.number().int(),
});

export type DeviceSubmitReadingRequest = z.infer<typeof DeviceSubmitReadingRequestSchema>;

// DeviceSubmitWateringRequest is shared with WateringService — re-exported from watering.api.ts

// ── Force water ──

export const ForceWaterRequestSchema = z.object({
  durationSeconds: z.number().int().min(1).max(300),
});

export type ForceWaterRequest = z.infer<typeof ForceWaterRequestSchema>;

export const ForceWaterResponseSchema = z.object({
  commandId: z.string(),
  status: z.literal("queued"),
});

export type ForceWaterResponse = z.infer<typeof ForceWaterResponseSchema>;

// ── Device config (sent to ESP32) ──

export const DeviceConfigResponseSchema = z.object({
  settings: WateringSettingsSchema,
  pendingCommands: z.array(PendingCommandSchema),
});

export type DeviceConfigResponse = z.infer<typeof DeviceConfigResponseSchema>;

// ── Device status (for users) ──

export const DeviceStatusResponseSchema = z.object({
  deviceId: z.string(),
  pairedAt: z.string().datetime(),
  lastSeenAt: z.string().datetime(),
});

export type DeviceStatusResponse = z.infer<typeof DeviceStatusResponseSchema>;

// ── Device watering (alias for shared type) ──
export const DeviceWateringRequestSchema = z.object({
  source: WateringSourceSchema,
  durationSeconds: z.number().int().min(0),
  moistureBeforePercent: z.number().min(0).max(100).nullable(),
  timestamp: z.string().datetime(),
  commandId: z.string().optional(),
});

export type DeviceWateringRequest = z.infer<typeof DeviceWateringRequestSchema>;
