import { beforeEach, describe, expect, it } from "vitest";
import { UserFlowersRepository } from "../../src/module/user-flowers/user-flowers.repository";
import { UserFlowersService } from "../../src/module/user-flowers/user-flowers.service";
import { WateringRepository } from "../../src/module/watering/watering.repository";
import { WateringService } from "../../src/module/watering/watering.service";
import { TEST_TABLE_NAMES } from "./setup/tables";
import { clearTable, getTestDynamoDBClient } from "./setup/test-helpers";

const makeLogger = () => ({ debug: () => {}, info: () => {}, error: () => {}, warn: () => {} }) as never;

function createServices() {
  const client = getTestDynamoDBClient();
  const flowersRepo = new UserFlowersRepository(client, TEST_TABLE_NAMES.userFlowers);
  const wateringRepo = new WateringRepository(client, TEST_TABLE_NAMES.wateringEvents);
  const flowersService = new UserFlowersService(flowersRepo, makeLogger());
  const wateringService = new WateringService(wateringRepo, flowersService, makeLogger());
  return { wateringService, flowersService };
}

describe("Watering integration", () => {
  beforeEach(async () => {
    await Promise.all([clearTable(TEST_TABLE_NAMES.wateringEvents), clearTable(TEST_TABLE_NAMES.userFlowers)]);
  });

  it("records manual watering and it appears in history", async () => {
    const { wateringService, flowersService } = createServices();

    const flower = await flowersService.create("user_1", { customName: "Fern" });
    const result = await wateringService.recordManualWatering("user_1", flower.userFlowerId, { durationSeconds: 15 });

    expect(result.source).toBe("manual");
    expect(result.durationSeconds).toBe(15);
    expect(result.userFlowerId).toBe(flower.userFlowerId);

    const history = await wateringService.getHistory("user_1", flower.userFlowerId, {});
    expect(history.items).toHaveLength(1);
    expect(history.items[0].source).toBe("manual");
    expect(history.items[0].durationSeconds).toBe(15);
  });

  it("updates flower lastWateredAt after recording watering", async () => {
    const { wateringService, flowersService } = createServices();

    const flower = await flowersService.create("user_1", { customName: "Rose" });
    expect(flower.lastWateredAt).toBeNull();

    await wateringService.recordManualWatering("user_1", flower.userFlowerId, { durationSeconds: 5 });

    const updated = await flowersService.getOne("user_1", flower.userFlowerId);
    expect(updated.lastWateredAt).not.toBeNull();
  });

  it("returns history newest first", async () => {
    const { wateringService, flowersService } = createServices();

    const flower = await flowersService.create("user_1", { customName: "Cactus" });

    // Record 3 waterings with slight delays to get distinct timestamps
    await wateringService.recordManualWatering("user_1", flower.userFlowerId, { durationSeconds: 1 });
    await new Promise((r) => setTimeout(r, 10));
    await wateringService.recordManualWatering("user_1", flower.userFlowerId, { durationSeconds: 2 });
    await new Promise((r) => setTimeout(r, 10));
    await wateringService.recordManualWatering("user_1", flower.userFlowerId, { durationSeconds: 3 });

    const history = await wateringService.getHistory("user_1", flower.userFlowerId, {});

    expect(history.items).toHaveLength(3);
    // Newest first — last recorded (durationSeconds: 3) should be first
    expect(history.items[0].durationSeconds).toBe(3);
    expect(history.items[2].durationSeconds).toBe(1);
  });

  it("paginates history with limit and cursor", async () => {
    const { wateringService, flowersService } = createServices();

    const flower = await flowersService.create("user_1", { customName: "Orchid" });

    for (let i = 0; i < 4; i++) {
      await wateringService.recordManualWatering("user_1", flower.userFlowerId, { durationSeconds: i });
      await new Promise((r) => setTimeout(r, 10));
    }

    const page1 = await wateringService.getHistory("user_1", flower.userFlowerId, { limit: 2 });
    expect(page1.items).toHaveLength(2);
    expect(page1.nextCursor).not.toBeNull();

    const page2 = await wateringService.getHistory("user_1", flower.userFlowerId, {
      limit: 2,
      exclusiveStartKey: page1.nextCursor as string,
    });
    expect(page2.items).toHaveLength(2);

    // All 4 items should be returned across pages, no duplicates
    const allTimestamps = [...page1.items, ...page2.items].map((e) => e.timestamp);
    expect(new Set(allTimestamps).size).toBe(4);
  });
});
