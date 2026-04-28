import { z } from "zod";
import { WateringSettingsSchema } from "../entities/user-flower";

// ── Requests ──

export const CreateUserFlowerRequestSchema = z.object({
  customName: z.string().min(1).max(100),
  flowerId: z.string().nullable().optional(),
  settings: WateringSettingsSchema.partial().optional(),
  collectionId: z.string().optional(),
});

export const UpdateUserFlowerRequestSchema = z.object({
  customName: z.string().min(1).max(100).optional(),
  settings: WateringSettingsSchema.partial().optional(),
});

// ── Responses ──

export const UserFlowerResponseSchema = z.object({
  userFlowerId: z.string(),
  customName: z.string(),
  flowerId: z.string().nullable(),
  settings: WateringSettingsSchema,
  lastMoisturePercent: z.number().nullable(),
  lastReadingAt: z.string().nullable(),
  lastWateredAt: z.string().nullable(),
  deviceId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// ── Inferred Types ──

export type CreateUserFlowerRequest = z.infer<typeof CreateUserFlowerRequestSchema>;
export type UpdateUserFlowerRequest = z.infer<typeof UpdateUserFlowerRequestSchema>;
export type UserFlowerResponse = z.infer<typeof UserFlowerResponseSchema>;
export type UserFlowerListResponse = UserFlowerResponse[];
