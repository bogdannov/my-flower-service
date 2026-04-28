import type { Logger } from "winston";
import type {
  GetSensorReadingsQuery,
  SensorReading,
  SensorReadingResponse,
  SensorReadingsListResponse,
} from "../../types";
import type { ConfigType } from "../config/Config";
import type { UserFlowersService } from "../user-flowers/user-flowers.service";
import type { SensorReadingsRepository } from "./sensor-readings.repository";

const MS_PER_SECOND = 1000;
const SECONDS_PER_DAY = 86400;

export class SensorReadingsService {
  constructor(
    private readonly repository: SensorReadingsRepository,
    private readonly userFlowersService: UserFlowersService,
    private readonly config: ConfigType,
    private readonly logger: Logger,
  ) {}

  async recordReading(
    userFlowerId: string,
    userId: string,
    moisturePercent: number,
    rawValue: number,
    deviceId: string,
  ): Promise<void> {
    const now = new Date();
    const timestamp = now.toISOString();
    const ttl = Math.floor(now.getTime() / MS_PER_SECOND) + this.config.SENSOR_READINGS_TTL_DAYS * SECONDS_PER_DAY;

    const reading: SensorReading = {
      userFlowerId,
      timestamp,
      moisturePercent,
      rawValue,
      deviceId,
      ttl,
    };

    await this.repository.create(reading);
    await this.userFlowersService.updateSnapshot(userId, userFlowerId, {
      lastMoisturePercent: moisturePercent,
      lastReadingAt: timestamp,
    });

    this.logger.debug("Sensor reading recorded", { userFlowerId, deviceId, moisturePercent });
  }

  async getReadings(
    userId: string,
    userFlowerId: string,
    query: GetSensorReadingsQuery,
  ): Promise<SensorReadingsListResponse> {
    // Verify flower belongs to user (throws NotFoundError if not)
    await this.userFlowersService.getOne(userId, userFlowerId);

    const now = new Date();
    const to = query.to ?? now.toISOString();
    const from = query.from ?? new Date(now.getTime() - 24 * 60 * 60 * MS_PER_SECOND).toISOString();

    const exclusiveStartKey = query.exclusiveStartKey
      ? (JSON.parse(Buffer.from(query.exclusiveStartKey, "base64").toString("utf-8")) as Record<string, unknown>)
      : undefined;

    const result = await this.repository.getByTimeRange(userFlowerId, from, to, {
      limit: query.limit,
      exclusiveStartKey,
    });

    const nextCursor = result.lastEvaluatedKey
      ? Buffer.from(JSON.stringify(result.lastEvaluatedKey)).toString("base64")
      : null;

    return {
      items: result.items.map((r) => this.toResponse(r)),
      nextCursor,
    };
  }

  private toResponse(reading: SensorReading): SensorReadingResponse {
    return {
      userFlowerId: reading.userFlowerId,
      timestamp: reading.timestamp,
      moisturePercent: reading.moisturePercent,
      rawValue: reading.rawValue,
      deviceId: reading.deviceId,
    };
  }
}
