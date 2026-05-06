import { z } from "zod";
import { DeviceStatusSchema } from "../entities/device";
import { WateringSettingsSchema } from "../entities/user-flower";
import { PendingCommandSchema, WateringSourceSchema } from "../enums";

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

// ── Firmware update ──

export const FirmwareUpdateSchema = z.object({
  available: z.boolean(),
  version: z.string().optional(),
  url: z.string().url().optional(),
  checksum: z.string().optional(),
});

export type FirmwareUpdate = z.infer<typeof FirmwareUpdateSchema>;

// ── Device config (sent to ESP32) ──

export const DeviceConfigResponseSchema = z.object({
  settings: WateringSettingsSchema,
  pendingCommands: z.array(PendingCommandSchema),
  firmwareUpdate: FirmwareUpdateSchema,
});

export type DeviceConfigResponse = z.infer<typeof DeviceConfigResponseSchema>;

// ── Boot ──

export const DeviceBootRequestSchema = z.object({
  firmwareVersion: z.string(),
});

export type DeviceBootRequest = z.infer<typeof DeviceBootRequestSchema>;

export const DeviceBootResponseSchema = z.object({
  status: z.enum(["unlinked", "linked"]),
  config: DeviceConfigResponseSchema.optional(),
});

export type DeviceBootResponse = z.infer<typeof DeviceBootResponseSchema>;

// ── Link device to flower (user-facing) ──

export const LinkDeviceToFlowerRequestSchema = z.object({
  deviceId: z.string().min(1),
});

export type LinkDeviceToFlowerRequest = z.infer<typeof LinkDeviceToFlowerRequestSchema>;

// ── Device status (for users) ──

export const DeviceStatusResponseSchema = z.object({
  deviceId: z.string(),
  status: DeviceStatusSchema,
  pairedAt: z.string().datetime().nullable(),
  lastSeenAt: z.string().datetime().nullable(),
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
