import z from "zod";

const ConfigSchema = z.object({
  STAGE: z.enum(["dev", "staging", "prod"]),
  AWS_REGION: z.string().default("eu-central-1"),
  COLLECTIONS_TABLE: z.string(),
  USER_FLOWERS_TABLE: z.string(),
  WATERING_EVENTS_TABLE: z.string(),
  SENSOR_READINGS_TABLE: z.string(),
  DEVICES_TABLE: z.string(),
  PAIRING_CODES_TABLE: z.string(),
  AUTH0_DOMAIN: z.string(),
  AUTH0_AUDIENCE: z.string(),
  SENSOR_READINGS_TTL_DAYS: z.coerce.number().default(30),
  PAIRING_CODE_TTL_MINUTES: z.coerce.number().default(10),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  DYNAMODB_ENDPOINT: z.string().optional(),
});

export type ConfigType = z.infer<typeof ConfigSchema>;

export class Config {
  private parsed: ConfigType | undefined;

  get(): ConfigType {
    if (!this.parsed) {
      const result = ConfigSchema.safeParse(process.env);
      if (!result.success) {
        const issues = result.error.errors.map((e) => `  - ${e.path.join(".")}: ${e.message}`).join("\n");
        throw new Error(`Configuration validation failed:\n${issues}`);
      }
      this.parsed = result.data;
    }
    return this.parsed;
  }
}
