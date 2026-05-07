import type { Logger } from "winston";
import type {
  CreateWateringEventRequest,
  DeviceSubmitWateringRequest,
  WateringEvent,
  WateringEventResponse,
  WateringHistoryResponse,
} from "../../types";
import type { UserFlowersService } from "../user-flowers/user-flowers.service";
import type { WateringRepository } from "./watering.repository";

export class WateringService {
  constructor(
    private readonly repository: WateringRepository,
    private readonly userFlowersService: UserFlowersService,
    private readonly logger: Logger,
  ) {}

  async recordManualWatering(
    userId: string,
    userFlowerId: string,
    request: CreateWateringEventRequest,
  ): Promise<WateringEventResponse> {
    // Verify flower belongs to user (throws NotFoundError if not)
    await this.userFlowersService.getOne(userId, userFlowerId);

    const timestamp = new Date().toISOString();

    const event: WateringEvent = {
      userFlowerId,
      timestamp,
      source: "manual",
      durationSeconds: request.durationSeconds,
      moistureBeforePercent: null,
      deviceId: null,
      notes: request.notes ?? null,
    };

    await this.repository.create(event);
    await this.userFlowersService.updateSnapshot(userId, userFlowerId, { lastWateredAt: timestamp });

    this.logger.debug("Manual watering recorded", { userId, userFlowerId });

    return this.toResponse(event);
  }

  async recordDeviceWatering(
    userFlowerId: string,
    userId: string,
    request: DeviceSubmitWateringRequest,
    deviceId: string,
  ): Promise<void> {
    const event: WateringEvent = {
      userFlowerId,
      timestamp: request.timestamp,
      source: request.source,
      durationSeconds: request.durationSeconds,
      moistureBeforePercent: request.moistureBeforePercent,
      deviceId,
      notes: null,
    };

    await this.repository.create(event);
    await this.userFlowersService.updateSnapshot(userId, userFlowerId, { lastWateredAt: request.timestamp });

    this.logger.debug("Device watering recorded", { userFlowerId, deviceId });
  }

  async getHistory(
    userId: string,
    userFlowerId: string,
    query: { limit?: number; exclusiveStartKey?: string },
  ): Promise<WateringHistoryResponse> {
    // Verify flower belongs to user (throws NotFoundError if not)
    await this.userFlowersService.getOne(userId, userFlowerId);

    const exclusiveStartKey = query.exclusiveStartKey
      ? (JSON.parse(Buffer.from(query.exclusiveStartKey, "base64").toString("utf-8")) as Record<string, unknown>)
      : undefined;

    const result = await this.repository.getHistory(userFlowerId, {
      limit: query.limit,
      exclusiveStartKey,
    });

    const nextCursor = result.lastEvaluatedKey
      ? Buffer.from(JSON.stringify(result.lastEvaluatedKey)).toString("base64")
      : null;

    return {
      items: result.items.map((e) => this.toResponse(e)),
      nextCursor,
    };
  }

  private toResponse(event: WateringEvent): WateringEventResponse {
    return {
      userFlowerId: event.userFlowerId,
      timestamp: event.timestamp,
      source: event.source,
      durationSeconds: event.durationSeconds,
      moistureBeforePercent: event.moistureBeforePercent,
      deviceId: event.deviceId,
      notes: event.notes,
    };
  }
}
