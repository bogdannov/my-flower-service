import { createHash, randomBytes } from "node:crypto";
import { ulid } from "ulid";
import type { Logger } from "winston";
import type {
  Device,
  DeviceConfigResponse,
  DevicePairRequest,
  DevicePairResponse,
  DeviceStatusResponse,
  DeviceSubmitReadingRequest,
  DeviceWateringRequest,
  ForceWaterRequest,
  ForceWaterResponse,
  GeneratePairingCodeResponse,
  PairingCode,
} from "../../types";
import type { ConfigType } from "../config/Config";
import { ConflictError, GoneError, NotFoundError, UnauthorizedError, ValidationError } from "../errors";
import type { SensorReadingsService } from "../sensor-readings/sensor-readings.service";
import type { UserFlowersService } from "../user-flowers/user-flowers.service";
import type { WateringService } from "../watering/watering.service";
import type { DevicesRepository } from "./devices.repository";
import type { PairingRepository } from "./pairing.repository";

const SECONDS_PER_MINUTE = 60;
const MS_PER_SECOND = 1000;
const MAX_PAIRING_RETRIES = 5;
const CODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const CODE_LENGTH = 6;

export interface DeviceContext {
  deviceId: string;
  userFlowerId: string;
  userId: string;
}

export class DeviceService {
  constructor(
    private readonly devicesRepository: DevicesRepository,
    private readonly pairingRepository: PairingRepository,
    private readonly userFlowersService: UserFlowersService,
    private readonly wateringService: WateringService,
    private readonly sensorReadingsService: SensorReadingsService,
    private readonly config: ConfigType,
    private readonly logger: Logger,
  ) {}

  async generatePairingCode(userId: string, userFlowerId: string): Promise<GeneratePairingCodeResponse> {
    const flower = await this.userFlowersService.getOne(userId, userFlowerId);

    if (flower.deviceId !== null) {
      throw new ConflictError("Flower already has a paired device");
    }

    const ttl = Math.floor(Date.now() / MS_PER_SECOND) + this.config.PAIRING_CODE_TTL_MINUTES * SECONDS_PER_MINUTE;
    const expiresAt = new Date(ttl * MS_PER_SECOND).toISOString();

    for (let attempt = 0; attempt < MAX_PAIRING_RETRIES; attempt++) {
      const code = this.generateCode();
      const pairingCode: PairingCode = { code, userFlowerId, userId, ttl };
      const result = await this.pairingRepository.create(pairingCode);

      if (result.success) {
        this.logger.debug("Pairing code generated", { userId, userFlowerId });
        return { code, expiresAt };
      }
    }

    throw new ValidationError("Failed to generate unique pairing code — please try again");
  }

  async completePairing(request: DevicePairRequest): Promise<DevicePairResponse> {
    const pairingCode = await this.pairingRepository.findByCode(request.code);

    if (!pairingCode) {
      throw new NotFoundError("Pairing code");
    }

    const nowEpoch = Math.floor(Date.now() / MS_PER_SECOND);
    if (pairingCode.ttl < nowEpoch) {
      throw new GoneError("Pairing code has expired");
    }

    const rawApiKey = `${request.deviceId}.${randomBytes(32).toString("hex")}`;
    const apiKeyHash = this.hashApiKey(rawApiKey);
    const now = new Date().toISOString();

    const device: Device = {
      deviceId: request.deviceId,
      userFlowerId: pairingCode.userFlowerId,
      userId: pairingCode.userId,
      apiKeyHash,
      pairedAt: now,
      lastSeenAt: now,
    };

    await this.devicesRepository.create(device);

    // Link device to flower
    await this.userFlowersService.updateDeviceFields(pairingCode.userId, pairingCode.userFlowerId, {
      deviceId: request.deviceId,
    });

    // Consume the pairing code
    await this.pairingRepository.remove(request.code);

    const flower = await this.userFlowersService.getOne(pairingCode.userId, pairingCode.userFlowerId);

    this.logger.debug("Device pairing completed", {
      deviceId: request.deviceId,
      userFlowerId: pairingCode.userFlowerId,
    });

    return {
      apiKey: rawApiKey,
      userFlowerId: pairingCode.userFlowerId,
      settings: flower.settings,
    };
  }

  async authenticateByKey(apiKey: string): Promise<DeviceContext> {
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

    // Fire-and-forget: update lastSeenAt without blocking the response
    void this.devicesRepository.updateLastSeen(deviceId);

    return { deviceId: device.deviceId, userFlowerId: device.userFlowerId, userId: device.userId };
  }

  async submitReading(deviceContext: DeviceContext, request: DeviceSubmitReadingRequest): Promise<void> {
    await this.sensorReadingsService.recordReading(
      deviceContext.userFlowerId,
      deviceContext.userId,
      request.moisturePercent,
      request.rawValue,
      deviceContext.deviceId,
    );
  }

  async submitWatering(deviceContext: DeviceContext, request: DeviceWateringRequest): Promise<void> {
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
    const flower = await this.userFlowersService.getOneFull(deviceContext.userId, deviceContext.userFlowerId);
    return { settings: flower.settings, pendingCommands: flower.pendingCommands };
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

    await this.devicesRepository.remove(flower.deviceId);
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
      pairedAt: device.pairedAt,
      lastSeenAt: device.lastSeenAt,
    };
  }

  private generateCode(): string {
    let code = "";
    const bytes = randomBytes(CODE_LENGTH);
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += CODE_CHARS[bytes[i] % CODE_CHARS.length];
    }
    return code;
  }

  private hashApiKey(key: string): string {
    return createHash("sha256").update(key).digest("hex");
  }
}
