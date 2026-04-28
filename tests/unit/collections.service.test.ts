import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Logger } from "winston";
import type { CollectionsRepository } from "../../src/module/collections/collections.repository";
import { CollectionsService } from "../../src/module/collections/collections.service";
import { NotFoundError, ValidationError } from "../../src/module/errors";
import type { UserFlowersRepository } from "../../src/module/user-flowers/user-flowers.repository";
import type { Collection, UserFlower } from "../../src/types";

const makeCollection = (overrides: Partial<Collection> = {}): Collection => ({
  userId: "user_1",
  collectionId: "col_test",
  name: "Living Room",
  userFlowerIds: [],
  isDefault: false,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
  ...overrides,
});

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

const makeCollectionsRepo = (): CollectionsRepository =>
  ({
    findByUser: vi.fn(),
    findOne: vi.fn(),
    findDefault: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  }) as unknown as CollectionsRepository;

const makeFlowersRepo = (): UserFlowersRepository =>
  ({
    findOne: vi.fn(),
    batchGetByIds: vi.fn(),
  }) as unknown as UserFlowersRepository;

const makeLogger = (): Logger => ({ debug: vi.fn(), info: vi.fn(), error: vi.fn() }) as unknown as Logger;

describe("CollectionsService", () => {
  let collectionsRepo: ReturnType<typeof makeCollectionsRepo>;
  let flowersRepo: ReturnType<typeof makeFlowersRepo>;
  let service: CollectionsService;

  beforeEach(() => {
    collectionsRepo = makeCollectionsRepo();
    flowersRepo = makeFlowersRepo();
    service = new CollectionsService(collectionsRepo, flowersRepo, makeLogger());
  });

  describe("create", () => {
    it("generates collectionId with 'col_' prefix", async () => {
      vi.mocked(collectionsRepo.create).mockResolvedValue();

      const result = await service.create("user_1", { name: "Kitchen" });

      expect(result.collectionId).toMatch(/^col_/);
      expect(result.name).toBe("Kitchen");
      expect(result.isDefault).toBe(false);
      expect(result.userFlowerIds).toEqual([]);
    });
  });

  describe("list", () => {
    it("returns collections when they exist", async () => {
      vi.mocked(collectionsRepo.findByUser).mockResolvedValue([makeCollection()]);

      const result = await service.list("user_1");

      expect(result).toHaveLength(1);
      expect(result[0].collectionId).toBe("col_test");
    });

    it("calls ensureDefaultCollection when user has no collections", async () => {
      vi.mocked(collectionsRepo.findByUser)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([makeCollection({ isDefault: true })]);
      vi.mocked(collectionsRepo.findDefault).mockResolvedValue(null);
      vi.mocked(collectionsRepo.create).mockResolvedValue();

      const result = await service.list("user_1");

      expect(collectionsRepo.create).toHaveBeenCalledOnce();
      expect(result).toHaveLength(1);
    });
  });

  describe("getDetail", () => {
    it("throws NotFoundError when collection not found", async () => {
      vi.mocked(collectionsRepo.findOne).mockResolvedValue(null);

      await expect(service.getDetail("user_1", "col_missing")).rejects.toThrow(NotFoundError);
    });

    it("returns empty flowers array without calling batchGet for empty collection", async () => {
      vi.mocked(collectionsRepo.findOne).mockResolvedValue(makeCollection({ userFlowerIds: [] }));

      const result = await service.getDetail("user_1", "col_test");

      expect(result.flowers).toEqual([]);
      expect(flowersRepo.batchGetByIds).not.toHaveBeenCalled();
    });

    it("returns enriched flowers via batch-get", async () => {
      const flower = makeFlower();
      vi.mocked(collectionsRepo.findOne).mockResolvedValue(makeCollection({ userFlowerIds: ["uf_test"] }));
      vi.mocked(flowersRepo.batchGetByIds).mockResolvedValue([flower]);

      const result = await service.getDetail("user_1", "col_test");

      expect(result.flowers).toHaveLength(1);
      expect(result.flowers[0].userFlowerId).toBe("uf_test");
      expect(result.flowers[0]).not.toHaveProperty("userId");
    });
  });

  describe("remove", () => {
    it("throws ValidationError when trying to delete default collection", async () => {
      vi.mocked(collectionsRepo.findOne).mockResolvedValue(makeCollection({ isDefault: true }));

      await expect(service.remove("user_1", "col_test")).rejects.toThrow(ValidationError);
    });

    it("removes non-default collection", async () => {
      vi.mocked(collectionsRepo.findOne).mockResolvedValue(makeCollection({ isDefault: false }));
      vi.mocked(collectionsRepo.remove).mockResolvedValue();

      await service.remove("user_1", "col_test");

      expect(collectionsRepo.remove).toHaveBeenCalledWith("user_1", "col_test");
    });
  });

  describe("addFlower", () => {
    it("is idempotent when flower already in collection", async () => {
      const collection = makeCollection({ userFlowerIds: ["uf_test"] });
      vi.mocked(collectionsRepo.findOne).mockResolvedValue(collection);
      vi.mocked(flowersRepo.findOne).mockResolvedValue(makeFlower());

      const result = await service.addFlower("user_1", "col_test", "uf_test");

      expect(collectionsRepo.update).not.toHaveBeenCalled();
      expect(result.userFlowerIds).toEqual(["uf_test"]);
    });

    it("throws NotFoundError when flower doesn't exist", async () => {
      vi.mocked(collectionsRepo.findOne).mockResolvedValue(makeCollection());
      vi.mocked(flowersRepo.findOne).mockResolvedValue(null);

      await expect(service.addFlower("user_1", "col_test", "uf_missing")).rejects.toThrow(NotFoundError);
    });

    it("appends flower to collection", async () => {
      const collection = makeCollection({ userFlowerIds: [] });
      vi.mocked(collectionsRepo.findOne).mockResolvedValue(collection);
      vi.mocked(flowersRepo.findOne).mockResolvedValue(makeFlower());
      vi.mocked(collectionsRepo.update).mockResolvedValue(makeCollection({ userFlowerIds: ["uf_test"] }));

      const result = await service.addFlower("user_1", "col_test", "uf_test");

      expect(result.userFlowerIds).toContain("uf_test");
    });
  });

  describe("removeFlower", () => {
    it("removes flowerId from collection array", async () => {
      vi.mocked(collectionsRepo.findOne).mockResolvedValue(makeCollection({ userFlowerIds: ["uf_test", "uf_other"] }));
      vi.mocked(collectionsRepo.update).mockResolvedValue(makeCollection({ userFlowerIds: ["uf_other"] }));

      const result = await service.removeFlower("user_1", "col_test", "uf_test");

      const updateCall = vi.mocked(collectionsRepo.update).mock.calls[0];
      const fields = updateCall[2] as { userFlowerIds: string[] };
      expect(fields.userFlowerIds).toEqual(["uf_other"]);
      expect(result.userFlowerIds).toEqual(["uf_other"]);
    });
  });

  describe("ensureDefaultCollection", () => {
    it("creates default collection when none exists", async () => {
      vi.mocked(collectionsRepo.findDefault).mockResolvedValue(null);
      vi.mocked(collectionsRepo.create).mockResolvedValue();

      await service.ensureDefaultCollection("user_1");

      expect(collectionsRepo.create).toHaveBeenCalledOnce();
      const created = vi.mocked(collectionsRepo.create).mock.calls[0][0];
      expect(created.isDefault).toBe(true);
      expect(created.name).toBe("My Collection");
    });

    it("does nothing when default already exists", async () => {
      vi.mocked(collectionsRepo.findDefault).mockResolvedValue(makeCollection({ isDefault: true }));

      await service.ensureDefaultCollection("user_1");

      expect(collectionsRepo.create).not.toHaveBeenCalled();
    });
  });
});
