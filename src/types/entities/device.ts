import { z } from "zod";

export const DeviceStatusSchema = z.enum(["unlinked", "linked"]);

export const DeviceSchema = z.object({
  deviceId: z.string(),
  userFlowerId: z.string().nullable(),
  userId: z.string().nullable(),
  apiKeyHash: z.string(),
  status: DeviceStatusSchema,
  pairedAt: z.string().datetime().nullable(),
  lastSeenAt: z.string().datetime().nullable(),
});

export type Device = z.infer<typeof DeviceSchema>;
