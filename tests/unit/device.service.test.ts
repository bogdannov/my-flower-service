import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Logger } from "winston";
import type { ConfigType } from "../../src/module/config/Config";
import { DeviceService } from "../../src/module/device/device.service";
import type { DevicesRepository } from "../../src/module/device/devices.repository";
import { ConflictError, NotFoundError, UnauthorizedError, ValidationError } from "../../src/module/errors";
import type { SensorReadingsService } from "../../src/module/sensor-readings/sensor-readings.service";
import type { UserFlowersService } from "../../src/module/user-flowers/user-flowers.service";
import type { WateringService } from "../../src/module/watering/watering.service";
import type { Device, UserFlower, UserFlowerResponse } from "../../src/types";

// ── Fixtures ──

const makeFlowerResponse = (overrides: Partial<UserFlowerResponse> = {}): UserFlowerResponse => ({
  userFlowerId: "uf_test",
  customName: "Fern",
  flowerId: null,
  settings: {
    wateringThresholdPercent: 20,
    wateringDurationSeconds: 5,
    checkIntervalSeconds: 30,
    scheduledWateringEnabled: false,
    scheduledWateringTime: null,
  },
  lastMoisturePercent: null,
  lastReadingAt: null,
  lastWateredAt: null,
  deviceId: null,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
  ...overrides,
});

const makeFlowerFull = (overrides: Partial<UserFlower> = {}): UserFlower => ({
  userId: "user_1",
  userFlowerId: "uf_test",
  customName: "Fern",
  flowerId: null,
  settings: {
    wateringThresholdPercent: 20,
    wateringDurationSeconds: 5,
    checkIntervalSeconds: 30,
    scheduledWateringEnabled: false,
    scheduledWateringTime: null,
  },
  lastMoisturePercent: null,
  lastReadingAt: null,
  lastWateredAt: null,
  deviceId: null,
  pendingCommands: [],
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
  ...overrides,
});

const makeDevice = (overrides: Partial<Device> = {}): Device => ({
  deviceId: "mf-00001",
  userFlowerId: null,
  userId: null,
  apiKeyHash: "abc123hash",
  status: "unlinked",
  firmwareVersion: null,
  pairedAt: null,
  lastSeenAt: null,
  ...overrides,
});

const makeConfig = (): ConfigType =>
  ({
    SENSOR_READINGS_TTL_DAYS: 30,
    LATEST_FIRMWARE_VERSION: "1.1.0",
    LATEST_FIRMWARE_URL: "https://example.com/firmware.bin",
    LATEST_FIRMWARE_CHECKSUM: "abc123checksum",
  }) as ConfigType;

// ── Mocks ──

const makeDevicesRepo = (): DevicesRepository =>
  ({
    findByDeviceId: vi.fn(),
    create: vi.fn(),
    updateLastSeen: vi.fn(),
    updateOnBoot: vi.fn(),
    linkToFlower: vi.fn(),
    resetLinkage: vi.fn(),
    remove: vi.fn(),
  }) as unknown as DevicesRepository;

const makeUserFlowersService = (): UserFlowersService =>
  ({
    getOne: vi.fn(),
    getOneFull: vi.fn(),
    update: vi.fn(),
    updateDeviceFields: vi.fn(),
    updateSnapshot: vi.fn(),
  }) as unknown as UserFlowersService;

const makeWateringService = (): WateringService => ({ recordDeviceWatering: vi.fn() }) as unknown as WateringService;

const makeSensorReadingsService = (): SensorReadingsService =>
  ({ recordReading: vi.fn() }) as unknown as SensorReadingsService;

const makeLogger = (): Logger => ({ debug: vi.fn(), info: vi.fn(), error: vi.fn() }) as unknown as Logger;

describe("DeviceService", () => {
  let devicesRepo: ReturnType<typeof makeDevicesRepo>;
  let userFlowersService: ReturnType<typeof makeUserFlowersService>;
  let wateringService: ReturnType<typeof makeWateringService>;
  let sensorReadingsService: ReturnType<typeof makeSensorReadingsService>;
  let service: DeviceService;

  beforeEach(() => {
    devicesRepo = makeDevicesRepo();
    userFlowersService = makeUserFlowersService();
    wateringService = makeWateringService();
    sensorReadingsService = makeSensorReadingsService();
    service = new DeviceService(
      devicesRepo,
      userFlowersService,
      wateringService,
      sensorReadingsService,
      makeConfig(),
      makeLogger(),
    );
  });

  describe("boot", () => {
    it("returns { status: 'unlinked' } when device is not linked", async () => {
      const { createHash: ch } = await import("node:crypto");
      const apiKey = "mf-00001.somesecretpart";
      const hash = ch("sha256").update(apiKey).digest("hex");
      vi.mocked(devicesRepo.findByDeviceId).mockResolvedValue(makeDevice({ apiKeyHash: hash, status: "unlinked" }));
      vi.mocked(devicesRepo.updateOnBoot).mockResolvedValue();

      const result = await service.boot(apiKey, { firmwareVersion: "1.0.0" });

      expect(result.status).toBe("unlinked");
      expect(result.config).toBeUndefined();
      expect(devicesRepo.updateOnBoot).toHaveBeenCalledWith("mf-00001", "1.0.0");
    });

    it("returns { status: 'linked', config } when device is already linked", async () => {
      const apiKey = "mf-00001.somesecretpart";
      const hash = createHash("sha256").update(apiKey).digest("hex");
      vi.mocked(devicesRepo.findByDeviceId).mockResolvedValue(
        makeDevice({ apiKeyHash: hash, status: "linked", userFlowerId: "uf_test", userId: "user_1" }),
      );
      vi.mocked(devicesRepo.updateOnBoot).mockResolvedValue();
      vi.mocked(userFlowersService.getOneFull).mockResolvedValue(makeFlowerFull({ deviceId: "mf-00001" }));

      const result = await service.boot(apiKey, { firmwareVersion: "1.0.0" });

      expect(result.status).toBe("linked");
      expect(result.config).toBeDefined();
      expect(result.config?.firmwareUpdate).toBeDefined();
    });

    it("throws UnauthorizedError for invalid key", async () => {
      vi.mocked(devicesRepo.findByDeviceId).mockResolvedValue(makeDevice({ apiKeyHash: "wronghash" }));

      await expect(service.boot("mf-00001.wrongkey", { firmwareVersion: "1.0.0" })).rejects.toThrow(UnauthorizedError);
    });

    it("throws UnauthorizedError for non-existent device", async () => {
      vi.mocked(devicesRepo.findByDeviceId).mockResolvedValue(null);

      await expect(service.boot("mf-00001.anykey", { firmwareVersion: "1.0.0" })).rejects.toThrow(UnauthorizedError);
    });
  });

  describe("linkToFlower", () => {
    it("links device to flower and returns DeviceStatusResponse", async () => {
      vi.mocked(userFlowersService.getOne).mockResolvedValue(makeFlowerResponse({ deviceId: null }));
      vi.mocked(devicesRepo.findByDeviceId).mockResolvedValue(makeDevice({ status: "online" }));
      vi.mocked(devicesRepo.linkToFlower).mockResolvedValue();
      vi.mocked(userFlowersService.updateDeviceFields).mockResolvedValue();

      const result = await service.linkToFlower("user_1", "uf_test", { deviceId: "mf-00001" });

      expect(result.deviceId).toBe("mf-00001");
      expect(result.status).toBe("linked");
      expect(devicesRepo.linkToFlower).toHaveBeenCalledWith("mf-00001", "uf_test", "user_1");
      expect(userFlowersService.updateDeviceFields).toHaveBeenCalledWith("user_1", "uf_test", { deviceId: "mf-00001" });
    });

    it("is idempotent when device is already linked to the same flower", async () => {
      vi.mocked(userFlowersService.getOne).mockResolvedValue(makeFlowerResponse({ deviceId: "mf-00001" }));
      vi.mocked(devicesRepo.findByDeviceId).mockResolvedValue(
        makeDevice({ status: "linked", userFlowerId: "uf_test", userId: "user_1" }),
      );

      const result = await service.linkToFlower("user_1", "uf_test", { deviceId: "mf-00001" });

      expect(result.status).toBe("linked");
      expect(devicesRepo.linkToFlower).not.toHaveBeenCalled();
      expect(userFlowersService.updateDeviceFields).not.toHaveBeenCalled();
    });

    it("throws ConflictError when device is linked to a different flower", async () => {
      vi.mocked(userFlowersService.getOne).mockResolvedValue(makeFlowerResponse({ deviceId: null }));
      vi.mocked(devicesRepo.findByDeviceId).mockResolvedValue(
        makeDevice({ status: "linked", userFlowerId: "uf_other", userId: "user_1" }),
      );

      await expect(service.linkToFlower("user_1", "uf_test", { deviceId: "mf-00001" })).rejects.toThrow(ConflictError);
    });

    it("throws ConflictError when flower already has a different device", async () => {
      vi.mocked(userFlowersService.getOne).mockResolvedValue(makeFlowerResponse({ deviceId: "mf-00099" }));

      await expect(service.linkToFlower("user_1", "uf_test", { deviceId: "mf-00001" })).rejects.toThrow(ConflictError);
    });

    it("throws NotFoundError when device does not exist", async () => {
      vi.mocked(userFlowersService.getOne).mockResolvedValue(makeFlowerResponse({ deviceId: null }));
      vi.mocked(devicesRepo.findByDeviceId).mockResolvedValue(null);

      await expect(service.linkToFlower("user_1", "uf_test", { deviceId: "mf-99999" })).rejects.toThrow(NotFoundError);
    });
  });

  describe("authenticateByKey", () => {
    it("returns device context for valid key", async () => {
      const apiKey = "mf-00001.somesecretpart";
      const hash = createHash("sha256").update(apiKey).digest("hex");
      vi.mocked(devicesRepo.findByDeviceId).mockResolvedValue(
        makeDevice({ apiKeyHash: hash, status: "linked", userFlowerId: "uf_test", userId: "user_1" }),
      );
      vi.mocked(devicesRepo.updateLastSeen).mockResolvedValue();

      const ctx = await service.authenticateByKey(apiKey);

      expect(ctx.deviceId).toBe("mf-00001");
      expect(ctx.userFlowerId).toBe("uf_test");
      expect(ctx.userId).toBe("user_1");
    });

    it("returns null userFlowerId for unlinked device", async () => {
      const apiKey = "mf-00001.somesecretpart";
      const hash = createHash("sha256").update(apiKey).digest("hex");
      vi.mocked(devicesRepo.findByDeviceId).mockResolvedValue(makeDevice({ apiKeyHash: hash, status: "online" }));
      vi.mocked(devicesRepo.updateLastSeen).mockResolvedValue();

      const ctx = await service.authenticateByKey(apiKey);

      expect(ctx.userFlowerId).toBeNull();
      expect(ctx.userId).toBeNull();
    });

    it("throws UnauthorizedError for wrong key (hash mismatch)", async () => {
      vi.mocked(devicesRepo.findByDeviceId).mockResolvedValue(makeDevice({ apiKeyHash: "wronghash" }));

      await expect(service.authenticateByKey("mf-00001.wrongkey")).rejects.toThrow(UnauthorizedError);
    });

    it("throws UnauthorizedError for non-existent device", async () => {
      vi.mocked(devicesRepo.findByDeviceId).mockResolvedValue(null);

      await expect(service.authenticateByKey("GHOST-999.somekey")).rejects.toThrow(UnauthorizedError);
    });
  });

  describe("submitReading", () => {
    it("delegates to sensorReadingsService.recordReading", async () => {
      vi.mocked(sensorReadingsService.recordReading).mockResolvedValue();

      const ctx = { deviceId: "mf-00001", userFlowerId: "uf_test", userId: "user_1" };
      await service.submitReading(ctx, { moisturePercent: 45, rawValue: 2048 });

      expect(sensorReadingsService.recordReading).toHaveBeenCalledWith("uf_test", "user_1", 45, 2048, "mf-00001");
    });

    it("throws ValidationError when device is not linked", async () => {
      const ctx = { deviceId: "mf-00001", userFlowerId: null, userId: null };

      await expect(service.submitReading(ctx, { moisturePercent: 45, rawValue: 2048 })).rejects.toThrow(
        ValidationError,
      );
    });
  });

  describe("submitWatering", () => {
    it("records watering and removes pending command when commandId provided", async () => {
      const flower = makeFlowerFull({
        pendingCommands: [
          { commandId: "cmd_abc", type: "force_water", durationSeconds: 5, createdAt: "2024-01-01T00:00:00.000Z" },
        ],
      });
      vi.mocked(wateringService.recordDeviceWatering).mockResolvedValue();
      vi.mocked(userFlowersService.getOneFull).mockResolvedValue(flower);
      vi.mocked(userFlowersService.updateDeviceFields).mockResolvedValue();

      const ctx = { deviceId: "mf-00001", userFlowerId: "uf_test", userId: "user_1" };
      await service.submitWatering(ctx, {
        source: "force",
        durationSeconds: 5,
        moistureBeforePercent: 20,
        timestamp: "2024-01-02T00:00:00.000Z",
        commandId: "cmd_abc",
      });

      const updateCall = vi.mocked(userFlowersService.updateDeviceFields).mock.calls[0];
      expect(updateCall[2].pendingCommands).toHaveLength(0);
    });

    it("throws ValidationError when device is not linked", async () => {
      const ctx = { deviceId: "mf-00001", userFlowerId: null, userId: null };

      await expect(
        service.submitWatering(ctx, {
          source: "force",
          durationSeconds: 5,
          moistureBeforePercent: 20,
          timestamp: "2024-01-02T00:00:00.000Z",
        }),
      ).rejects.toThrow(ValidationError);
    });
  });

  describe("getConfig", () => {
    it("returns idle config with firmwareUpdate when device is not linked", async () => {
      vi.mocked(devicesRepo.findByDeviceId).mockResolvedValue(makeDevice({ firmwareVersion: "1.0.0" }));

      const ctx = { deviceId: "mf-00001", userFlowerId: null, userId: null };
      const config = await service.getConfig(ctx);

      expect(config.pendingCommands).toHaveLength(0);
      // firmware update available since 1.0.0 !== 1.1.0 (from makeConfig)
      expect(config.firmwareUpdate.available).toBe(true);
      expect(config.firmwareUpdate.version).toBe("1.1.0");
    });

    it("returns flower settings and firmwareUpdate when device is linked", async () => {
      vi.mocked(devicesRepo.findByDeviceId).mockResolvedValue(makeDevice({ firmwareVersion: "1.1.0" }));
      vi.mocked(userFlowersService.getOneFull).mockResolvedValue(makeFlowerFull({ deviceId: "mf-00001" }));

      const ctx = { deviceId: "mf-00001", userFlowerId: "uf_test", userId: "user_1" };
      const config = await service.getConfig(ctx);

      expect(config.settings.wateringThresholdPercent).toBe(20);
      // firmware is up to date
      expect(config.firmwareUpdate.available).toBe(false);
    });
  });

  describe("forceWater", () => {
    it("appends command to pendingCommands", async () => {
      vi.mocked(userFlowersService.getOneFull).mockResolvedValue(
        makeFlowerFull({ deviceId: "mf-00001", pendingCommands: [] }),
      );
      vi.mocked(userFlowersService.updateDeviceFields).mockResolvedValue();

      const result = await service.forceWater("user_1", "uf_test", { durationSeconds: 10 });

      expect(result.commandId).toMatch(/^cmd_/);
      expect(result.status).toBe("queued");
      const updateCall = vi.mocked(userFlowersService.updateDeviceFields).mock.calls[0];
      expect(updateCall[2].pendingCommands).toHaveLength(1);
      expect(updateCall[2].pendingCommands?.[0]?.type).toBe("force_water");
    });

    it("throws ValidationError when no device paired", async () => {
      vi.mocked(userFlowersService.getOneFull).mockResolvedValue(makeFlowerFull({ deviceId: null }));

      await expect(service.forceWater("user_1", "uf_test", { durationSeconds: 5 })).rejects.toThrow(ValidationError);
    });
  });

  describe("unpairDevice", () => {
    it("resets device linkage and clears flower deviceId and pendingCommands", async () => {
      vi.mocked(userFlowersService.getOne).mockResolvedValue(makeFlowerResponse({ deviceId: "mf-00001" }));
      vi.mocked(devicesRepo.resetLinkage).mockResolvedValue();
      vi.mocked(userFlowersService.updateDeviceFields).mockResolvedValue();

      await service.unpairDevice("user_1", "uf_test");

      expect(devicesRepo.resetLinkage).toHaveBeenCalledWith("mf-00001");
      // Device record is NOT deleted — it stays in DB as "online"
      expect(devicesRepo.remove).not.toHaveBeenCalled();
      expect(userFlowersService.updateDeviceFields).toHaveBeenCalledWith("user_1", "uf_test", {
        deviceId: null,
        pendingCommands: [],
      });
    });
  });
});
