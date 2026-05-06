import { createHash, randomBytes } from "node:crypto";
import { ulid } from "ulid";
import type { Logger } from "winston";
import type {
  Device,
  DeviceBootRequest,
  DeviceBootResponse,
  DeviceConfigResponse,
  DeviceStatusResponse,
  DeviceSubmitReadingRequest,
  DeviceWateringRequest,
  ForceWaterRequest,
  ForceWaterResponse,
  LinkDeviceToFlowerRequest,
} from "../../types";
import type { ConfigType } from "../config/Config";
import { ConflictError, NotFoundError, UnauthorizedError, ValidationError } from "../errors";
import type { SensorReadingsService } from "../sensor-readings/sensor-readings.service";
import type { UserFlowersService } from "../user-flowers/user-flowers.service";
import type { WateringService } from "../watering/watering.service";
import type { DevicesRepository } from "./devices.repository";

const MS_PER_SECOND = 1000;

export interface DeviceContext {
  deviceId: string;
  userFlowerId: string | null;
  userId: string | null;
}

export class DeviceService {
  constructor(
    private readonly devicesRepository: DevicesRepository,
    private readonly userFlowersService: UserFlowersService,
    private readonly wateringService: WateringService,
    private readonly sensorReadingsService: SensorReadingsService,
    private readonly config: ConfigType,
    private readonly logger: Logger,
  ) {}

  async boot(apiKey: string, request: DeviceBootRequest): Promise<DeviceBootResponse> {
    const device = await this.findAndVerifyDevice(apiKey);

    await this.devicesRepository.updateOnBoot(device.deviceId, request.firmwareVersion);

    if (device.status === "linked" && device.userFlowerId !== null && device.userId !== null) {
      const ctx: DeviceContext = {
        deviceId: device.deviceId,
        userFlowerId: device.userFlowerId,
        userId: device.userId,
      };
      const config = await this.getConfig(ctx);
      return { status: "linked", config };
    }

    this.logger.debug("Device booted, not yet linked", { deviceId: device.deviceId });
    return { status: "unlinked" };
  }

  async linkToFlower(
    userId: string,
    userFlowerId: string,
    request: LinkDeviceToFlowerRequest,
  ): Promise<DeviceStatusResponse> {
    const flower = await this.userFlowersService.getOne(userId, userFlowerId);

    // Reject if flower already linked to a DIFFERENT device
    if (flower.deviceId !== null && flower.deviceId !== request.deviceId) {
      throw new ConflictError("Flower already has a paired device");
    }

    const device = await this.devicesRepository.findByDeviceId(request.deviceId);

    if (!device) {
      throw new NotFoundError("Device");
    }

    // Idempotent: already linked to this flower
    if (device.status === "linked" && device.userFlowerId === userFlowerId) {
      return {
        deviceId: device.deviceId,
        status: device.status,
        pairedAt: device.pairedAt,
        lastSeenAt: device.lastSeenAt,
      };
    }

    // Reject if device is linked to a different flower
    if (device.status === "linked" && device.userFlowerId !== userFlowerId) {
      throw new ConflictError("Device already linked to another plant");
    }

    await this.devicesRepository.linkToFlower(request.deviceId, userFlowerId, userId);
    await this.userFlowersService.updateDeviceFields(userId, userFlowerId, { deviceId: request.deviceId });

    this.logger.debug("Device linked to flower", { deviceId: request.deviceId, userFlowerId, userId });

    const now = new Date().toISOString();
    return {
      deviceId: request.deviceId,
      status: "linked",
      pairedAt: now,
      lastSeenAt: device.lastSeenAt,
    };
  }

  async authenticateByKey(apiKey: string): Promise<DeviceContext> {
    const device = await this.findAndVerifyDevice(apiKey);

    // Fire-and-forget: update lastSeenAt without blocking the response
    void this.devicesRepository.updateLastSeen(device.deviceId);

    return { deviceId: device.deviceId, userFlowerId: device.userFlowerId, userId: device.userId };
  }

  async submitReading(deviceContext: DeviceContext, request: DeviceSubmitReadingRequest): Promise<void> {
    if (deviceContext.userFlowerId === null || deviceContext.userId === null) {
      throw new ValidationError("Device is not linked to a plant");
    }

    await this.sensorReadingsService.recordReading(
      deviceContext.userFlowerId,
      deviceContext.userId,
      request.moisturePercent,
      request.rawValue,
      deviceContext.deviceId,
    );
  }

  async submitWatering(deviceContext: DeviceContext, request: DeviceWateringRequest): Promise<void> {
    if (deviceContext.userFlowerId === null || deviceContext.userId === null) {
      throw new ValidationError("Device is not linked to a plant");
    }

    await this.wateringService.recordDeviceWatering(
      deviceContext.userFlowerId,
      deviceContext.userId,
      {
        source: request.source,
        durationSeconds: request.durationSeconds,
        moistureBeforePercent: request.moistureBeforePercent,
        timestamp: request.timestamp,
      },
      deviceContext.deviceId,
    );

    // Remove the completed command from pendingCommands if commandId provided
    if (request.commandId) {
      const flower = await this.userFlowersService.getOneFull(deviceContext.userId, deviceContext.userFlowerId);
      const pendingCommands = flower.pendingCommands.filter((cmd) => cmd.commandId !== request.commandId);
      await this.userFlowersService.updateDeviceFields(deviceContext.userId, deviceContext.userFlowerId, {
        pendingCommands,
      });
    }
  }

  async getConfig(deviceContext: DeviceContext): Promise<DeviceConfigResponse> {
    const device = await this.devicesRepository.findByDeviceId(deviceContext.deviceId);
    const firmwareUpdate = this.buildFirmwareUpdate(device?.firmwareVersion ?? null);

    if (deviceContext.userFlowerId === null || deviceContext.userId === null) {
      // Device is online but not linked to a plant — return idle config
      return {
        settings: {
          wateringThresholdPercent: 0,
          wateringDurationSeconds: 0,
          checkIntervalSeconds: 60,
          scheduledWateringEnabled: false,
          scheduledWateringTime: null,
        },
        pendingCommands: [],
        firmwareUpdate,
      };
    }

    const flower = await this.userFlowersService.getOneFull(deviceContext.userId, deviceContext.userFlowerId);
    return { settings: flower.settings, pendingCommands: flower.pendingCommands, firmwareUpdate };
  }

  async forceWater(userId: string, userFlowerId: string, request: ForceWaterRequest): Promise<ForceWaterResponse> {
    const flower = await this.userFlowersService.getOneFull(userId, userFlowerId);

    if (flower.deviceId === null) {
      throw new ValidationError("No device paired with this flower");
    }

    const commandId = `cmd_${ulid()}`;
    const now = new Date().toISOString();

    const newCommand = {
      commandId,
      type: "force_water" as const,
      durationSeconds: request.durationSeconds,
      createdAt: now,
    };

    await this.userFlowersService.updateDeviceFields(userId, userFlowerId, {
      pendingCommands: [...flower.pendingCommands, newCommand],
    });

    this.logger.debug("Force water command queued", { userId, userFlowerId, commandId });

    return { commandId, status: "queued" };
  }

  async unpairDevice(userId: string, userFlowerId: string): Promise<void> {
    const flower = await this.userFlowersService.getOne(userId, userFlowerId);

    if (flower.deviceId === null) {
      throw new NotFoundError("Device");
    }

    // Reset device linkage (keep record — device was factory-provisioned)
    await this.devicesRepository.resetLinkage(flower.deviceId);
    await this.userFlowersService.updateDeviceFields(userId, userFlowerId, { deviceId: null, pendingCommands: [] });

    this.logger.debug("Device unpaired", { userId, userFlowerId, deviceId: flower.deviceId });
  }

  async getDeviceStatus(userId: string, userFlowerId: string): Promise<DeviceStatusResponse> {
    const flower = await this.userFlowersService.getOne(userId, userFlowerId);

    if (flower.deviceId === null) {
      throw new NotFoundError("Device");
    }

    const device = await this.devicesRepository.findByDeviceId(flower.deviceId);

    if (!device) {
      throw new NotFoundError("Device");
    }

    return {
      deviceId: device.deviceId,
      status: device.status,
      pairedAt: device.pairedAt,
      lastSeenAt: device.lastSeenAt,
    };
  }

  private async findAndVerifyDevice(apiKey: string): Promise<Device> {
    const deviceId = apiKey.split(".")[0];

    if (!deviceId) {
      throw new UnauthorizedError("Invalid device key format");
    }

    const device = await this.devicesRepository.findByDeviceId(deviceId);

    if (!device) {
      throw new UnauthorizedError("Invalid device key");
    }

    const hash = this.hashApiKey(apiKey);
    if (hash !== device.apiKeyHash) {
      throw new UnauthorizedError("Invalid device key");
    }

    return device;
  }

  private buildFirmwareUpdate(deviceFirmwareVersion: string | null) {
    const latestVersion = this.config.LATEST_FIRMWARE_VERSION;

    if (deviceFirmwareVersion === null || deviceFirmwareVersion === latestVersion) {
      return { available: false };
    }

    return {
      available: true,
      version: latestVersion,
      url: this.config.LATEST_FIRMWARE_URL,
      checksum: this.config.LATEST_FIRMWARE_CHECKSUM,
    };
  }

  private hashApiKey(key: string): string {
    return createHash("sha256").update(key).digest("hex");
  }
}
