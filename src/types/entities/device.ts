import { z } from "zod";

export const DeviceSchema = z.object({
  deviceId: z.string(),
  userFlowerId: z.string(),
  userId: z.string(),
  apiKeyHash: z.string(),
  pairedAt: z.string().datetime(),
  lastSeenAt: z.string().datetime(),
});

export type Device = z.infer<typeof DeviceSchema>;

export const PairingCodeSchema = z.object({
  code: z.string(),
  userFlowerId: z.string(),
  userId: z.string(),
  ttl: z.number().int(),
});

export type PairingCode = z.infer<typeof PairingCodeSchema>;
