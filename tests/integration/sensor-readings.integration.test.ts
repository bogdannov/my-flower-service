import { beforeEach, describe, expect, it } from "vitest";
import type { ConfigType } from "../../src/module/config/Config";
import { SensorReadingsRepository } from "../../src/module/sensor-readings/sensor-readings.repository";
import { SensorReadingsService } from "../../src/module/sensor-readings/sensor-readings.service";
import { UserFlowersRepository } from "../../src/module/user-flowers/user-flowers.repository";
import { UserFlowersService } from "../../src/module/user-flowers/user-flowers.service";
import { TEST_TABLE_NAMES } from "./setup/tables";
import { clearTable, getTestDynamoDBClient } from "./setup/test-helpers";

const makeLogger = () => ({ debug: () => {}, info: () => {}, error: () => {}, warn: () => {} }) as never;

const testConfig: ConfigType = {
  SENSOR_READINGS_TTL_DAYS: 30,
} as ConfigType;

function createServices() {
  const client = getTestDynamoDBClient();
  const flowersRepo = new UserFlowersRepository(client, TEST_TABLE_NAMES.userFlowers);
  const readingsRepo = new SensorReadingsRepository(client, TEST_TABLE_NAMES.sensorReadings);
  const flowersService = new UserFlowersService(flowersRepo, makeLogger());
  const readingsService = new SensorReadingsService(readingsRepo, flowersService, testConfig, makeLogger());
  return { readingsService, flowersService };
}

describe("SensorReadings integration", () => {
  beforeEach(async () => {
    await Promise.all([clearTable(TEST_TABLE_NAMES.sensorReadings), clearTable(TEST_TABLE_NAMES.userFlowers)]);
  });

  it("records readings and retrieves them by time range", async () => {
    const { readingsService, flowersService } = createServices();

    const flower = await flowersService.create("user_1", { customName: "Fern" });

    await readingsService.recordReading(flower.userFlowerId, "user_1", 45, 2048, "AA:BB:CC:DD:EE:FF");
    await new Promise((r) => setTimeout(r, 10));
    await readingsService.recordReading(flower.userFlowerId, "user_1", 50, 2200, "AA:BB:CC:DD:EE:FF");

    const result = await readingsService.getReadings("user_1", flower.userFlowerId, {});

    expect(result.items).toHaveLength(2);
    expect(result.items[0].moisturePercent).toBe(45);
    expect(result.items[1].moisturePercent).toBe(50);
  });

  it("returns readings in chronological order (oldest first)", async () => {
    const { readingsService, flowersService } = createServices();

    const flower = await flowersService.create("user_1", { customName: "Cactus" });

    for (let i = 0; i < 3; i++) {
      await readingsService.recordReading(flower.userFlowerId, "user_1", 30 + i * 10, 1000 + i * 100, "dev1");
      await new Promise((r) => setTimeout(r, 10));
    }

    const result = await readingsService.getReadings("user_1", flower.userFlowerId, {});

    expect(result.items).toHaveLength(3);
    expect(result.items[0].moisturePercent).toBe(30);
    expect(result.items[1].moisturePercent).toBe(40);
    expect(result.items[2].moisturePercent).toBe(50);
  });

  it("updates flower snapshot after recording reading", async () => {
    const { readingsService, flowersService } = createServices();

    const flower = await flowersService.create("user_1", { customName: "Rose" });
    expect(flower.lastMoisturePercent).toBeNull();
    expect(flower.lastReadingAt).toBeNull();

    await readingsService.recordReading(flower.userFlowerId, "user_1", 72, 3000, "AA:BB:CC:DD:EE:FF");

    const updated = await flowersService.getOne("user_1", flower.userFlowerId);
    expect(updated.lastMoisturePercent).toBe(72);
    expect(updated.lastReadingAt).not.toBeNull();
  });

  it("paginates readings with limit and cursor", async () => {
    const { readingsService, flowersService } = createServices();

    const flower = await flowersService.create("user_1", { customName: "Orchid" });

    for (let i = 0; i < 4; i++) {
      await readingsService.recordReading(flower.userFlowerId, "user_1", 40 + i, 2000 + i, "dev1");
      await new Promise((r) => setTimeout(r, 10));
    }

    const page1 = await readingsService.getReadings("user_1", flower.userFlowerId, { limit: 2 });
    expect(page1.items).toHaveLength(2);
    expect(page1.nextCursor).not.toBeNull();

    const page2 = await readingsService.getReadings("user_1", flower.userFlowerId, {
      limit: 2,
      exclusiveStartKey: page1.nextCursor as string,
    });
    expect(page2.items).toHaveLength(2);

    const allTimestamps = [...page1.items, ...page2.items].map((r) => r.timestamp);
    expect(new Set(allTimestamps).size).toBe(4);
  });
});
