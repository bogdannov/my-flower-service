import { z } from "zod";
import { PendingCommandSchema } from "../enums";

export const WateringSettingsSchema = z.object({
  wateringThresholdPercent: z.number().min(0).max(100).default(20),
  wateringDurationSeconds: z.number().min(1).max(60).default(5),
  checkIntervalSeconds: z.number().min(10).max(300).default(30),
  scheduledWateringEnabled: z.boolean().default(false),
  scheduledWateringTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable()
    .default(null),
});
export type WateringSettings = z.infer<typeof WateringSettingsSchema>;

export const UserFlowerSchema = z.object({
  userId: z.string(),
  userFlowerId: z.string(),
  customName: z.string().min(1).max(100),
  flowerId: z.string().nullable().default(null),
  settings: WateringSettingsSchema,
  lastMoisturePercent: z.number().nullable().default(null),
  lastReadingAt: z.string().datetime().nullable().default(null),
  lastWateredAt: z.string().datetime().nullable().default(null),
  deviceId: z.string().nullable().default(null),
  pendingCommands: z.array(PendingCommandSchema).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type UserFlower = z.infer<typeof UserFlowerSchema>;
