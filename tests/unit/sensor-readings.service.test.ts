import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Logger } from "winston";
import type { ConfigType } from "../../src/module/config/Config";
import { NotFoundError } from "../../src/module/errors";
import type { SensorReadingsRepository } from "../../src/module/sensor-readings/sensor-readings.repository";
import { SensorReadingsService } from "../../src/module/sensor-readings/sensor-readings.service";
import type { UserFlowersService } from "../../src/module/user-flowers/user-flowers.service";
import type { SensorReading, UserFlowerResponse } from "../../src/types";

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

const makeReading = (overrides: Partial<SensorReading> = {}): SensorReading => ({
  userFlowerId: "uf_test",
  timestamp: "2024-01-02T10:00:00.000Z",
  moisturePercent: 45,
  rawValue: 2048,
  deviceId: "AA:BB:CC:DD:EE:FF",
  ttl: 1700000000,
  ...overrides,
});

const makeConfig = (): ConfigType =>
  ({
    SENSOR_READINGS_TTL_DAYS: 30,
  }) as ConfigType;

const makeRepo = (): SensorReadingsRepository =>
  ({
    create: vi.fn(),
    getByTimeRange: vi.fn(),
    getLatest: vi.fn(),
  }) as unknown as SensorReadingsRepository;

const makeUserFlowersService = (): UserFlowersService =>
  ({
    getOne: vi.fn(),
    updateSnapshot: vi.fn(),
  }) as unknown as UserFlowersService;

const makeLogger = (): Logger => ({ debug: vi.fn(), info: vi.fn(), error: vi.fn() }) as unknown as Logger;

describe("SensorReadingsService", () => {
  let repo: ReturnType<typeof makeRepo>;
  let userFlowersService: ReturnType<typeof makeUserFlowersService>;
  let service: SensorReadingsService;

  beforeEach(() => {
    repo = makeRepo();
    userFlowersService = makeUserFlowersService();
    service = new SensorReadingsService(repo, userFlowersService, makeConfig(), makeLogger());
  });

  describe("recordReading", () => {
    it("calculates TTL correctly (now + configured days in epoch seconds)", async () => {
      vi.mocked(repo.create).mockResolvedValue();
      vi.mocked(userFlowersService.updateSnapshot).mockResolvedValue();

      const before = Math.floor(Date.now() / 1000);
      await service.recordReading("uf_test", "user_1", 45, 2048, "AA:BB:CC:DD:EE:FF");
      const after = Math.floor(Date.now() / 1000);

      const created = vi.mocked(repo.create).mock.calls[0][0];
      const expectedMin = before + 30 * 86400;
      const expectedMax = after + 30 * 86400;
      expect(created.ttl).toBeGreaterThanOrEqual(expectedMin);
      expect(created.ttl).toBeLessThanOrEqual(expectedMax);
    });

    it("updates flower snapshot with moisturePercent and readingAt", async () => {
      vi.mocked(repo.create).mockResolvedValue();
      vi.mocked(userFlowersService.updateSnapshot).mockResolvedValue();

      await service.recordReading("uf_test", "user_1", 55, 1800, "AA:BB:CC:DD:EE:FF");

      expect(userFlowersService.updateSnapshot).toHaveBeenCalledWith(
        "user_1",
        "uf_test",
        expect.objectContaining({ lastMoisturePercent: 55 }),
      );
    });
  });

  describe("getReadings", () => {
    it("defaults to 24h window when no from/to provided", async () => {
      vi.mocked(userFlowersService.getOne).mockResolvedValue(makeFlowerResponse());
      vi.mocked(repo.getByTimeRange).mockResolvedValue({ items: [], lastEvaluatedKey: undefined });

      const before = new Date();
      await service.getReadings("user_1", "uf_test", {});
      const after = new Date();

      const call = vi.mocked(repo.getByTimeRange).mock.calls[0];
      const fromArg = new Date(call[1]);
      const toArg = new Date(call[2]);

      // "from" should be ~24h before "to"
      const diffMs = toArg.getTime() - fromArg.getTime();
      expect(diffMs).toBeCloseTo(24 * 60 * 60 * 1000, -3);

      // "to" should be within test execution time
      expect(toArg.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000);
      expect(toArg.getTime()).toBeLessThanOrEqual(after.getTime() + 1000);
    });

    it("throws NotFoundError for non-existent flower", async () => {
      vi.mocked(userFlowersService.getOne).mockRejectedValue(new NotFoundError("UserFlower"));

      await expect(service.getReadings("user_1", "uf_missing", {})).rejects.toThrow(NotFoundError);

      expect(repo.getByTimeRange).not.toHaveBeenCalled();
    });
  });
});
