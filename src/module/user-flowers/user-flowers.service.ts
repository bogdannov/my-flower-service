import { ulid } from "ulid";
import type { Logger } from "winston";
import { WateringSettingsSchema } from "../../types";
import type {
  CreateUserFlowerRequest,
  UpdateUserFlowerRequest,
  UserFlower,
  UserFlowerListResponse,
  UserFlowerResponse,
} from "../../types";
import { NotFoundError } from "../errors";
import type { UserFlowersRepository } from "./user-flowers.repository";

export class UserFlowersService {
  constructor(
    private readonly repository: UserFlowersRepository,
    private readonly logger: Logger,
  ) {}

  async create(userId: string, request: CreateUserFlowerRequest): Promise<UserFlowerResponse> {
    const now = new Date().toISOString();
    const userFlowerId = `uf_${ulid()}`;

    const defaultSettings = WateringSettingsSchema.parse({});
    const settings = { ...defaultSettings, ...(request.settings ?? {}) };

    const flower: UserFlower = {
      userId,
      userFlowerId,
      customName: request.customName,
      flowerId: request.flowerId ?? null,
      settings,
      lastMoisturePercent: null,
      lastReadingAt: null,
      lastWateredAt: null,
      deviceId: null,
      pendingCommands: [],
      createdAt: now,
      updatedAt: now,
    };

    await this.repository.create(flower);
    this.logger.debug("UserFlower created", { userId, userFlowerId });

    return this.toResponse(flower);
  }

  async list(userId: string): Promise<UserFlowerListResponse> {
    const flowers = await this.repository.findByUser(userId);
    return flowers.map((f) => this.toResponse(f));
  }

  async getOne(userId: string, userFlowerId: string): Promise<UserFlowerResponse> {
    const flower = await this.repository.findOne(userId, userFlowerId);
    if (!flower) throw new NotFoundError("UserFlower");
    return this.toResponse(flower);
  }

  async update(userId: string, userFlowerId: string, request: UpdateUserFlowerRequest): Promise<UserFlowerResponse> {
    const existing = await this.repository.findOne(userId, userFlowerId);
    if (!existing) throw new NotFoundError("UserFlower");

    const fields: Partial<UserFlower> = {};

    if (request.customName !== undefined) {
      fields.customName = request.customName;
    }

    if (request.settings !== undefined) {
      fields.settings = { ...existing.settings, ...request.settings };
    }

    const updated = await this.repository.update(userId, userFlowerId, fields);
    return this.toResponse(updated);
  }

  async remove(userId: string, userFlowerId: string): Promise<void> {
    const existing = await this.repository.findOne(userId, userFlowerId);
    if (!existing) throw new NotFoundError("UserFlower");

    await this.repository.remove(userId, userFlowerId);
    this.logger.debug("UserFlower removed", { userId, userFlowerId });
  }

  // Called by WateringService and SensorReadingsService to keep snapshot fields in sync.
  async updateSnapshot(
    userId: string,
    userFlowerId: string,
    snapshot: { lastMoisturePercent?: number; lastReadingAt?: string; lastWateredAt?: string },
  ): Promise<void> {
    await this.repository.update(userId, userFlowerId, snapshot);
  }

  // Internal method for device operations that need to update deviceId or pendingCommands.
  // Not exposed to the public API — only used by DeviceService.
  async updateDeviceFields(userId: string, userFlowerId: string, fields: Partial<UserFlower>): Promise<void> {
    await this.repository.update(userId, userFlowerId, fields);
  }

  // Returns the full entity including pendingCommands — for DeviceService internal use.
  async getOneFull(userId: string, userFlowerId: string): Promise<UserFlower> {
    const flower = await this.repository.findOne(userId, userFlowerId);
    if (!flower) throw new NotFoundError("UserFlower");
    return flower;
  }

  private toResponse(flower: UserFlower): UserFlowerResponse {
    return {
      userFlowerId: flower.userFlowerId,
      customName: flower.customName,
      flowerId: flower.flowerId,
      settings: flower.settings,
      lastMoisturePercent: flower.lastMoisturePercent,
      lastReadingAt: flower.lastReadingAt,
      lastWateredAt: flower.lastWateredAt,
      deviceId: flower.deviceId ?? null,
      createdAt: flower.createdAt,
      updatedAt: flower.updatedAt,
    };
  }
}
