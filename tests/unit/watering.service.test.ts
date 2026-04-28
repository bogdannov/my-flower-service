import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Logger } from "winston";
import { NotFoundError } from "../../src/module/errors";
import type { UserFlowersService } from "../../src/module/user-flowers/user-flowers.service";
import type { WateringRepository } from "../../src/module/watering/watering.repository";
import { WateringService } from "../../src/module/watering/watering.service";
import type { UserFlowerResponse, WateringEvent } from "../../src/types";

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

const makeEvent = (overrides: Partial<WateringEvent> = {}): WateringEvent => ({
  userFlowerId: "uf_test",
  timestamp: "2024-01-02T10:00:00.000Z",
  source: "manual",
  durationSeconds: 0,
  moistureBeforePercent: null,
  deviceId: null,
  ...overrides,
});

const makeRepo = (): WateringRepository =>
  ({
    create: vi.fn(),
    getHistory: vi.fn(),
    getLatest: vi.fn(),
  }) as unknown as WateringRepository;

const makeUserFlowersService = (): UserFlowersService =>
  ({
    getOne: vi.fn(),
    updateSnapshot: vi.fn(),
  }) as unknown as UserFlowersService;

const makeLogger = (): Logger => ({ debug: vi.fn(), info: vi.fn(), error: vi.fn() }) as unknown as Logger;

describe("WateringService", () => {
  let repo: ReturnType<typeof makeRepo>;
  let userFlowersService: ReturnType<typeof makeUserFlowersService>;
  let service: WateringService;

  beforeEach(() => {
    repo = makeRepo();
    userFlowersService = makeUserFlowersService();
    service = new WateringService(repo, userFlowersService, makeLogger());
  });

  describe("recordManualWatering", () => {
    it("creates event with source 'manual' and updates snapshot", async () => {
      vi.mocked(userFlowersService.getOne).mockResolvedValue(makeFlowerResponse());
      vi.mocked(repo.create).mockResolvedValue();
      vi.mocked(userFlowersService.updateSnapshot).mockResolvedValue();

      const result = await service.recordManualWatering("user_1", "uf_test", { durationSeconds: 10 });

      expect(result.source).toBe("manual");
      expect(result.durationSeconds).toBe(10);
      expect(result.moistureBeforePercent).toBeNull();
      expect(result.deviceId).toBeNull();
      expect(repo.create).toHaveBeenCalledOnce();

      const createdEvent = vi.mocked(repo.create).mock.calls[0][0];
      expect(createdEvent.source).toBe("manual");
      expect(createdEvent.userFlowerId).toBe("uf_test");

      expect(userFlowersService.updateSnapshot).toHaveBeenCalledWith("user_1", "uf_test", {
        lastWateredAt: result.timestamp,
      });
    });

    it("throws NotFoundError when flower doesn't belong to user", async () => {
      vi.mocked(userFlowersService.getOne).mockRejectedValue(new NotFoundError("UserFlower"));

      await expect(service.recordManualWatering("user_1", "uf_missing", { durationSeconds: 0 })).rejects.toThrow(
        NotFoundError,
      );

      expect(repo.create).not.toHaveBeenCalled();
    });
  });

  describe("getHistory", () => {
    it("returns paginated results newest first", async () => {
      const events = [
        makeEvent({ timestamp: "2024-01-03T00:00:00.000Z" }),
        makeEvent({ timestamp: "2024-01-02T00:00:00.000Z" }),
      ];
      vi.mocked(userFlowersService.getOne).mockResolvedValue(makeFlowerResponse());
      vi.mocked(repo.getHistory).mockResolvedValue({ items: events, lastEvaluatedKey: undefined });

      const result = await service.getHistory("user_1", "uf_test", { limit: 10 });

      expect(result.items).toHaveLength(2);
      expect(result.items[0].timestamp).toBe("2024-01-03T00:00:00.000Z");
      expect(result.nextCursor).toBeNull();
    });

    it("encodes lastEvaluatedKey as base64 cursor", async () => {
      const lastKey = { PK: { S: "uf_test" }, SK: { S: "2024-01-01T00:00:00.000Z" } };
      vi.mocked(userFlowersService.getOne).mockResolvedValue(makeFlowerResponse());
      vi.mocked(repo.getHistory).mockResolvedValue({ items: [], lastEvaluatedKey: lastKey });

      const result = await service.getHistory("user_1", "uf_test", { limit: 1 });

      expect(result.nextCursor).not.toBeNull();
      const decoded = JSON.parse(Buffer.from(result.nextCursor as string, "base64").toString("utf-8"));
      expect(decoded).toEqual(lastKey);
    });

    it("decodes base64 cursor into exclusiveStartKey for next page", async () => {
      const lastKey = { PK: { S: "uf_test" }, SK: { S: "2024-01-01T00:00:00.000Z" } };
      const cursor = Buffer.from(JSON.stringify(lastKey)).toString("base64");

      vi.mocked(userFlowersService.getOne).mockResolvedValue(makeFlowerResponse());
      vi.mocked(repo.getHistory).mockResolvedValue({ items: [], lastEvaluatedKey: undefined });

      await service.getHistory("user_1", "uf_test", { exclusiveStartKey: cursor });

      const historyCall = vi.mocked(repo.getHistory).mock.calls[0];
      expect(historyCall[1]?.exclusiveStartKey).toEqual(lastKey);
    });
  });
});
