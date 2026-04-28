import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Logger } from "winston";
import type { ConfigType } from "../../src/module/config/Config";
import { DeviceService } from "../../src/module/device/device.service";
import type { DevicesRepository } from "../../src/module/device/devices.repository";
import type { PairingRepository } from "../../src/module/device/pairing.repository";
import { ConflictError, GoneError, NotFoundError, UnauthorizedError, ValidationError } from "../../src/module/errors";
import type { SensorReadingsService } from "../../src/module/sensor-readings/sensor-readings.service";
import type { UserFlowersService } from "../../src/module/user-flowers/user-flowers.service";
import type { WateringService } from "../../src/module/watering/watering.service";
import type { Device, PairingCode, UserFlower, UserFlowerResponse } from "../../src/types";

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
  deviceId: "ESP32-001",
  userFlowerId: "uf_test",
  userId: "user_1",
  apiKeyHash: "abc123hash",
  pairedAt: "2024-01-01T00:00:00.000Z",
  lastSeenAt: "2024-01-01T00:00:00.000Z",
  ...overrides,
});

const makeValidCode = (): PairingCode => ({
  code: "ABC123",
  userFlowerId: "uf_test",
  userId: "user_1",
  ttl: Math.floor(Date.now() / 1000) + 600, // 10 min from now
});

const makeConfig = (): ConfigType =>
  ({
    PAIRING_CODE_TTL_MINUTES: 10,
  }) as ConfigType;

// ── Mocks ──

const makeDevicesRepo = (): DevicesRepository =>
  ({
    findByDeviceId: vi.fn(),
    create: vi.fn(),
    updateLastSeen: vi.fn(),
    remove: vi.fn(),
  }) as unknown as DevicesRepository;

const makePairingRepo = (): PairingRepository =>
  ({
    findByCode: vi.fn(),
    create: vi.fn(),
    remove: vi.fn(),
  }) as unknown as PairingRepository;

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
  let pairingRepo: ReturnType<typeof makePairingRepo>;
  let userFlowersService: ReturnType<typeof makeUserFlowersService>;
  let wateringService: ReturnType<typeof makeWateringService>;
  let sensorReadingsService: ReturnType<typeof makeSensorReadingsService>;
  let service: DeviceService;

  beforeEach(() => {
    devicesRepo = makeDevicesRepo();
    pairingRepo = makePairingRepo();
    userFlowersService = makeUserFlowersService();
    wateringService = makeWateringService();
    sensorReadingsService = makeSensorReadingsService();
    service = new DeviceService(
      devicesRepo,
      pairingRepo,
      userFlowersService,
      wateringService,
      sensorReadingsService,
      makeConfig(),
      makeLogger(),
    );
  });

  describe("generatePairingCode", () => {
    it("creates a 6-character uppercase alphanumeric code", async () => {
      vi.mocked(userFlowersService.getOne).mockResolvedValue(makeFlowerResponse({ deviceId: null }));
      vi.mocked(pairingRepo.create).mockResolvedValue({ success: true });

      const result = await service.generatePairingCode("user_1", "uf_test");

      expect(result.code).toMatch(/^[A-Z0-9]{6}$/);
      expect(result.expiresAt).toBeTruthy();
    });

    it("retries on code collision and succeeds on second attempt", async () => {
      vi.mocked(userFlowersService.getOne).mockResolvedValue(makeFlowerResponse({ deviceId: null }));
      vi.mocked(pairingRepo.create).mockResolvedValueOnce({ success: false }).mockResolvedValueOnce({ success: true });

      const result = await service.generatePairingCode("user_1", "uf_test");

      expect(pairingRepo.create).toHaveBeenCalledTimes(2);
      expect(result.code).toMatch(/^[A-Z0-9]{6}$/);
    });

    it("throws ConflictError when flower already has a paired device", async () => {
      vi.mocked(userFlowersService.getOne).mockResolvedValue(makeFlowerResponse({ deviceId: "ESP32-001" }));

      await expect(service.generatePairingCode("user_1", "uf_test")).rejects.toThrow(ConflictError);

      expect(pairingRepo.create).not.toHaveBeenCalled();
    });
  });

  describe("completePairing", () => {
    it("full flow: finds code, creates device, links to flower, deletes code", async () => {
      const code = makeValidCode();
      vi.mocked(pairingRepo.findByCode).mockResolvedValue(code);
      vi.mocked(devicesRepo.create).mockResolvedValue();
      vi.mocked(userFlowersService.updateDeviceFields).mockResolvedValue();
      vi.mocked(pairingRepo.remove).mockResolvedValue();
      vi.mocked(userFlowersService.getOne).mockResolvedValue(makeFlowerResponse({ deviceId: "ESP32-001" }));

      const result = await service.completePairing({ deviceId: "ESP32-001", code: "ABC123" });

      expect(result.apiKey).toMatch(/^ESP32-001\./);
      expect(result.userFlowerId).toBe("uf_test");
      expect(devicesRepo.create).toHaveBeenCalledOnce();
      expect(userFlowersService.updateDeviceFields).toHaveBeenCalledWith("user_1", "uf_test", {
        deviceId: "ESP32-001",
      });
      expect(pairingRepo.remove).toHaveBeenCalledWith("ABC123");
    });

    it("throws NotFoundError for invalid pairing code", async () => {
      vi.mocked(pairingRepo.findByCode).mockResolvedValue(null);

      await expect(service.completePairing({ deviceId: "ESP32-001", code: "BADCOD" })).rejects.toThrow(NotFoundError);
    });

    it("throws GoneError for expired pairing code", async () => {
      const expiredCode: PairingCode = {
        code: "EXPIRD",
        userFlowerId: "uf_test",
        userId: "user_1",
        ttl: Math.floor(Date.now() / 1000) - 60, // 1 min ago
      };
      vi.mocked(pairingRepo.findByCode).mockResolvedValue(expiredCode);

      await expect(service.completePairing({ deviceId: "ESP32-001", code: "EXPIRD" })).rejects.toThrow(GoneError);
    });
  });

  describe("authenticateByKey", () => {
    it("returns device context for valid key", async () => {
      const { createHash } = await import("node:crypto");
      const apiKey = "ESP32-001.somesecretpart";
      const hash = createHash("sha256").update(apiKey).digest("hex");
      vi.mocked(devicesRepo.findByDeviceId).mockResolvedValue(makeDevice({ apiKeyHash: hash }));
      vi.mocked(devicesRepo.updateLastSeen).mockResolvedValue();

      const ctx = await service.authenticateByKey(apiKey);

      expect(ctx.deviceId).toBe("ESP32-001");
      expect(ctx.userFlowerId).toBe("uf_test");
      expect(ctx.userId).toBe("user_1");
    });

    it("throws UnauthorizedError for wrong key (hash mismatch)", async () => {
      vi.mocked(devicesRepo.findByDeviceId).mockResolvedValue(makeDevice({ apiKeyHash: "wronghash" }));

      await expect(service.authenticateByKey("ESP32-001.wrongkey")).rejects.toThrow(UnauthorizedError);
    });

    it("throws UnauthorizedError for non-existent device", async () => {
      vi.mocked(devicesRepo.findByDeviceId).mockResolvedValue(null);

      await expect(service.authenticateByKey("GHOST-999.somekey")).rejects.toThrow(UnauthorizedError);
    });
  });

  describe("submitReading", () => {
    it("delegates to sensorReadingsService.recordReading", async () => {
      vi.mocked(sensorReadingsService.recordReading).mockResolvedValue();

      const ctx = { deviceId: "ESP32-001", userFlowerId: "uf_test", userId: "user_1" };
      await service.submitReading(ctx, { moisturePercent: 45, rawValue: 2048 });

      expect(sensorReadingsService.recordReading).toHaveBeenCalledWith("uf_test", "user_1", 45, 2048, "ESP32-001");
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

      const ctx = { deviceId: "ESP32-001", userFlowerId: "uf_test", userId: "user_1" };
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
  });

  describe("forceWater", () => {
    it("appends command to pendingCommands", async () => {
      vi.mocked(userFlowersService.getOneFull).mockResolvedValue(
        makeFlowerFull({ deviceId: "ESP32-001", pendingCommands: [] }),
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
    it("deletes device and clears flower deviceId and pendingCommands", async () => {
      vi.mocked(userFlowersService.getOne).mockResolvedValue(makeFlowerResponse({ deviceId: "ESP32-001" }));
      vi.mocked(devicesRepo.remove).mockResolvedValue();
      vi.mocked(userFlowersService.updateDeviceFields).mockResolvedValue();

      await service.unpairDevice("user_1", "uf_test");

      expect(devicesRepo.remove).toHaveBeenCalledWith("ESP32-001");
      expect(userFlowersService.updateDeviceFields).toHaveBeenCalledWith("user_1", "uf_test", {
        deviceId: null,
        pendingCommands: [],
      });
    });
  });
});
