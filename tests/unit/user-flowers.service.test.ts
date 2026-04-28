import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Logger } from "winston";
import { NotFoundError } from "../../src/module/errors";
import type { UserFlowersRepository } from "../../src/module/user-flowers/user-flowers.repository";
import { UserFlowersService } from "../../src/module/user-flowers/user-flowers.service";
import type { UserFlower } from "../../src/types";

const makeFlower = (overrides: Partial<UserFlower> = {}): UserFlower => ({
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

const makeRepo = (): UserFlowersRepository =>
  ({
    findByUser: vi.fn(),
    findOne: vi.fn(),
    findByDeviceId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    batchGetByIds: vi.fn(),
  }) as unknown as UserFlowersRepository;

const makeLogger = (): Logger => ({ debug: vi.fn(), info: vi.fn(), error: vi.fn() }) as unknown as Logger;

describe("UserFlowersService", () => {
  let repo: ReturnType<typeof makeRepo>;
  let service: UserFlowersService;

  beforeEach(() => {
    repo = makeRepo();
    service = new UserFlowersService(repo, makeLogger());
  });

  describe("create", () => {
    it("generates userFlowerId with 'uf_' prefix", async () => {
      vi.mocked(repo.create).mockResolvedValue();

      const result = await service.create("user_1", { customName: "Rose" });

      expect(result.userFlowerId).toMatch(/^uf_/);
      expect(repo.create).toHaveBeenCalledOnce();
    });

    it("applies default settings when none provided", async () => {
      vi.mocked(repo.create).mockResolvedValue();

      const result = await service.create("user_1", { customName: "Rose" });

      expect(result.settings.wateringThresholdPercent).toBe(20);
      expect(result.settings.wateringDurationSeconds).toBe(5);
      expect(result.settings.checkIntervalSeconds).toBe(30);
      expect(result.settings.scheduledWateringEnabled).toBe(false);
    });

    it("merges provided settings with defaults", async () => {
      vi.mocked(repo.create).mockResolvedValue();

      const result = await service.create("user_1", {
        customName: "Rose",
        settings: { wateringThresholdPercent: 40 },
      });

      expect(result.settings.wateringThresholdPercent).toBe(40);
      expect(result.settings.wateringDurationSeconds).toBe(5);
    });

    it("response does not contain userId", async () => {
      vi.mocked(repo.create).mockResolvedValue();

      const result = await service.create("user_1", { customName: "Rose" });

      expect(result).not.toHaveProperty("userId");
    });
  });

  describe("list", () => {
    it("returns mapped responses without userId", async () => {
      vi.mocked(repo.findByUser).mockResolvedValue([makeFlower()]);

      const result = await service.list("user_1");

      expect(result).toHaveLength(1);
      expect(result[0]).not.toHaveProperty("userId");
      expect(result[0].userFlowerId).toBe("uf_test");
    });
  });

  describe("getOne", () => {
    it("throws NotFoundError when flower not found", async () => {
      vi.mocked(repo.findOne).mockResolvedValue(null);

      await expect(service.getOne("user_1", "uf_missing")).rejects.toThrow(NotFoundError);
    });

    it("returns mapped response when found", async () => {
      vi.mocked(repo.findOne).mockResolvedValue(makeFlower());

      const result = await service.getOne("user_1", "uf_test");

      expect(result.userFlowerId).toBe("uf_test");
      expect(result.customName).toBe("Fern");
      expect(result).not.toHaveProperty("userId");
    });
  });

  describe("update", () => {
    it("throws NotFoundError when flower doesn't exist", async () => {
      vi.mocked(repo.findOne).mockResolvedValue(null);

      await expect(service.update("user_1", "uf_missing", { customName: "X" })).rejects.toThrow(NotFoundError);
    });

    it("calls repository.update with only provided fields", async () => {
      const flower = makeFlower();
      vi.mocked(repo.findOne).mockResolvedValue(flower);
      vi.mocked(repo.update).mockResolvedValue({ ...flower, customName: "Lily" });

      await service.update("user_1", "uf_test", { customName: "Lily" });

      expect(repo.update).toHaveBeenCalledWith("user_1", "uf_test", { customName: "Lily" });
    });

    it("merges partial settings with existing settings", async () => {
      const flower = makeFlower();
      vi.mocked(repo.findOne).mockResolvedValue(flower);
      vi.mocked(repo.update).mockResolvedValue(flower);

      await service.update("user_1", "uf_test", {
        settings: { wateringThresholdPercent: 50 },
      });

      const updateCall = vi.mocked(repo.update).mock.calls[0];
      const fields = updateCall[2] as {
        settings: { wateringThresholdPercent: number; wateringDurationSeconds: number };
      };
      expect(fields.settings.wateringThresholdPercent).toBe(50);
      expect(fields.settings.wateringDurationSeconds).toBe(5);
    });
  });

  describe("remove", () => {
    it("throws NotFoundError when flower doesn't exist", async () => {
      vi.mocked(repo.findOne).mockResolvedValue(null);

      await expect(service.remove("user_1", "uf_missing")).rejects.toThrow(NotFoundError);
    });

    it("calls repository.remove when flower exists", async () => {
      vi.mocked(repo.findOne).mockResolvedValue(makeFlower());
      vi.mocked(repo.remove).mockResolvedValue();

      await service.remove("user_1", "uf_test");

      expect(repo.remove).toHaveBeenCalledWith("user_1", "uf_test");
    });
  });

  describe("updateSnapshot", () => {
    it("calls repository.update with only snapshot fields", async () => {
      vi.mocked(repo.update).mockResolvedValue(makeFlower());

      const snapshot = { lastMoisturePercent: 45, lastReadingAt: "2024-01-02T00:00:00.000Z" };
      await service.updateSnapshot("user_1", "uf_test", snapshot);

      expect(repo.update).toHaveBeenCalledWith("user_1", "uf_test", snapshot);
    });
  });
});
