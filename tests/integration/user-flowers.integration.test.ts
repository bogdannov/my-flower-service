import { beforeEach, describe, expect, it } from "vitest";
import { NotFoundError } from "../../src/module/errors";
import { UserFlowersRepository } from "../../src/module/user-flowers/user-flowers.repository";
import { UserFlowersService } from "../../src/module/user-flowers/user-flowers.service";
import type { UserFlower } from "../../src/types";
import { TEST_TABLE_NAMES } from "./setup/tables";
import { clearTable, getTestDynamoDBClient, seedItem } from "./setup/test-helpers";

const makeLogger = () => ({ debug: () => {}, info: () => {}, error: () => {}, warn: () => {} }) as never;

function createService(): UserFlowersService {
  const client = getTestDynamoDBClient();
  const repo = new UserFlowersRepository(client, TEST_TABLE_NAMES.userFlowers);
  return new UserFlowersService(repo, makeLogger());
}

describe("UserFlowers integration", () => {
  beforeEach(async () => {
    await clearTable(TEST_TABLE_NAMES.userFlowers);
  });

  it("creates a flower and retrieves it with all fields", async () => {
    const service = createService();

    const created = await service.create("user_1", {
      customName: "Monstera",
      settings: { wateringThresholdPercent: 30 },
    });

    expect(created.customName).toBe("Monstera");
    expect(created.settings.wateringThresholdPercent).toBe(30);
    expect(created.settings.wateringDurationSeconds).toBe(5);
    expect(created.userFlowerId).toMatch(/^uf_/);
    expect(created).not.toHaveProperty("userId");

    const retrieved = await service.getOne("user_1", created.userFlowerId);
    expect(retrieved.customName).toBe("Monstera");
    expect(retrieved.userFlowerId).toBe(created.userFlowerId);
  });

  it("lists flowers for a user and excludes other users' flowers", async () => {
    const service = createService();

    await service.create("user_1", { customName: "Fern" });
    await service.create("user_1", { customName: "Cactus" });
    await service.create("user_2", { customName: "OtherPlant" });

    const result = await service.list("user_1");

    expect(result).toHaveLength(2);
    expect(result.map((f) => f.customName).sort()).toEqual(["Cactus", "Fern"]);
  });

  it("updates flower name while keeping other fields intact", async () => {
    const service = createService();
    const created = await service.create("user_1", { customName: "OldName" });

    const updated = await service.update("user_1", created.userFlowerId, { customName: "NewName" });

    expect(updated.customName).toBe("NewName");
    expect(updated.settings.wateringThresholdPercent).toBe(20);
    expect(updated.updatedAt).not.toBe(created.updatedAt);
  });

  it("updates only the specified settings fields, preserving the rest", async () => {
    const service = createService();
    const created = await service.create("user_1", {
      customName: "Rose",
      settings: { wateringThresholdPercent: 25, wateringDurationSeconds: 10 },
    });

    const updated = await service.update("user_1", created.userFlowerId, {
      settings: { wateringThresholdPercent: 40 },
    });

    expect(updated.settings.wateringThresholdPercent).toBe(40);
    expect(updated.settings.wateringDurationSeconds).toBe(10);
  });

  it("deletes a flower", async () => {
    const service = createService();
    const created = await service.create("user_1", { customName: "Violet" });

    await service.remove("user_1", created.userFlowerId);

    await expect(service.getOne("user_1", created.userFlowerId)).rejects.toThrow(NotFoundError);
  });

  it("throws NotFoundError for non-existent flower", async () => {
    const service = createService();

    await expect(service.getOne("user_1", "uf_doesnotexist")).rejects.toThrow(NotFoundError);
  });

  it("findByDeviceId resolves via GSI", async () => {
    const client = getTestDynamoDBClient();
    const repo = new UserFlowersRepository(client, TEST_TABLE_NAMES.userFlowers);

    const flower: UserFlower = {
      userId: "user_1",
      userFlowerId: "uf_with_device",
      customName: "Paired Plant",
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
      deviceId: "AA:BB:CC:DD:EE:FF",
      pendingCommands: [],
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    };

    await seedItem(TEST_TABLE_NAMES.userFlowers, {
      PK: flower.userId,
      SK: flower.userFlowerId,
      ...flower,
    });

    const found = await repo.findByDeviceId("AA:BB:CC:DD:EE:FF");
    expect(found).not.toBeNull();
    expect(found?.userFlowerId).toBe("uf_with_device");
    expect(found?.deviceId).toBe("AA:BB:CC:DD:EE:FF");
  });
});
