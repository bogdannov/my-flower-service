import { z } from "zod";

export const WateringSourceSchema = z.enum(["manual", "auto", "scheduled", "force"]);
export type WateringSource = z.infer<typeof WateringSourceSchema>;

export const CommandTypeSchema = z.enum(["force_water"]);
export type CommandType = z.infer<typeof CommandTypeSchema>;

export const PendingCommandSchema = z.object({
  commandId: z.string(),
  type: CommandTypeSchema,
  durationSeconds: z.number(),
  createdAt: z.string().datetime(),
});
export type PendingCommand = z.infer<typeof PendingCommandSchema>;
