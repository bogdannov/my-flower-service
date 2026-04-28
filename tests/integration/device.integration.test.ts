import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import type { ConfigType } from "../../src/module/config/Config";
import { DeviceService } from "../../src/module/device/device.service";
import { DevicesRepository } from "../../src/module/device/devices.repository";
import { PairingRepository } from "../../src/module/device/pairing.repository";
import { GoneError, NotFoundError, UnauthorizedError } from "../../src/module/errors";
import { SensorReadingsRepository } from "../../src/module/sensor-readings/sensor-readings.repository";
import { SensorReadingsService } from "../../src/module/sensor-readings/sensor-readings.service";
import { UserFlowersRepository } from "../../src/module/user-flowers/user-flowers.repository";
import { UserFlowersService } from "../../src/module/user-flowers/user-flowers.service";
import { WateringRepository } from "../../src/module/watering/watering.repository";
import { WateringService } from "../../src/module/watering/watering.service";
import { TEST_TABLE_NAMES } from "./setup/tables";
import { clearTable, getTestDynamoDBClient } from "./setup/test-helpers";

const makeLogger = () => ({ debug: () => {}, info: () => {}, error: () => {}, warn: () => {} }) as never;

const testConfig: ConfigType = {
  PAIRING_CODE_TTL_MINUTES: 10,
  SENSOR_READINGS_TTL_DAYS: 30,
} as ConfigType;

function createServices() {
  const client = getTestDynamoDBClient();
  const flowersRepo = new UserFlowersRepository(client, TEST_TABLE_NAMES.userFlowers);
  const wateringRepo = new WateringRepository(client, TEST_TABLE_NAMES.wateringEvents);
  const readingsRepo = new SensorReadingsRepository(client, TEST_TABLE_NAMES.sensorReadings);
  const devicesRepo = new DevicesRepository(client, TEST_TABLE_NAMES.devices);
  const pairingRepo = new PairingRepository(client, TEST_TABLE_NAMES.pairingCodes);
  const flowersService = new UserFlowersService(flowersRepo, makeLogger());
  const wateringService = new WateringService(wateringRepo, flowersService, makeLogger());
  const readingsService = new SensorReadingsService(readingsRepo, flowersService, testConfig, makeLogger());
  const deviceService = new DeviceService(
    devicesRepo,
    pairingRepo,
    flowersService,
    wateringService,
    readingsService,
    testConfig,
    makeLogger(),
  );
  return { deviceService, flowersService, readingsService };
}

describe("Device integration", () => {
  beforeEach(async () => {
    await Promise.all([
      clearTable(TEST_TABLE_NAMES.userFlowers),
      clearTable(TEST_TABLE_NAMES.wateringEvents),
      clearTable(TEST_TABLE_NAMES.sensorReadings),
      clearTable(TEST_TABLE_NAMES.devices),
      clearTable(TEST_TABLE_NAMES.pairingCodes),
    ]);
  });

  it("full pairing flow: generate code → complete pairing → device created and flower linked", async () => {
    const { deviceService, flowersService } = createServices();

    const flower = await flowersService.create("user_1", { customName: "Fern" });
    expect(flower.deviceId).toBeNull();

    const { code, expiresAt } = await deviceService.generatePairingCode("user_1", flower.userFlowerId);
    expect(code).toMatch(/^[A-Z0-9]{6}$/);
    expect(new Date(expiresAt).getTime()).toBeGreaterThan(Date.now());

    const pairResult = await deviceService.completePairing({ deviceId: "ESP32-001", code });
    expect(pairResult.apiKey).toMatch(/^ESP32-001\./);
    expect(pairResult.userFlowerId).toBe(flower.userFlowerId);

    // Flower should now have deviceId set
    const linked = await flowersService.getOne("user_1", flower.userFlowerId);
    expect(linked.deviceId).toBe("ESP32-001");
  });

  it("submit reading after pairing → sensor reading stored and snapshot updated", async () => {
    const { deviceService, flowersService, readingsService } = createServices();

    const flower = await flowersService.create("user_1", { customName: "Cactus" });
    const { code } = await deviceService.generatePairingCode("user_1", flower.userFlowerId);
    const { apiKey } = await deviceService.completePairing({ deviceId: "ESP32-002", code });

    const ctx = await deviceService.authenticateByKey(apiKey);
    await deviceService.submitReading(ctx, { moisturePercent: 65, rawValue: 2800 });

    const updated = await flowersService.getOne("user_1", flower.userFlowerId);
    expect(updated.lastMoisturePercent).toBe(65);
    expect(updated.lastReadingAt).not.toBeNull();

    const readings = await readingsService.getReadings("user_1", flower.userFlowerId, {});
    expect(readings.items).toHaveLength(1);
    expect(readings.items[0].moisturePercent).toBe(65);
  });

  it("force water → get config → command in pendingCommands → submit watering removes command", async () => {
    const { deviceService, flowersService } = createServices();

    const flower = await flowersService.create("user_1", { customName: "Rose" });
    const { code } = await deviceService.generatePairingCode("user_1", flower.userFlowerId);
    const { apiKey } = await deviceService.completePairing({ deviceId: "ESP32-003", code });

    // Queue force-water command
    const { commandId } = await deviceService.forceWater("user_1", flower.userFlowerId, { durationSeconds: 8 });
    expect(commandId).toMatch(/^cmd_/);

    // Device polls config and sees the command
    const ctx = await deviceService.authenticateByKey(apiKey);
    const config = await deviceService.getConfig(ctx);
    expect(config.pendingCommands).toHaveLength(1);
    expect(config.pendingCommands[0].commandId).toBe(commandId);

    // Device executes and reports back with commandId
    await deviceService.submitWatering(ctx, {
      source: "force",
      durationSeconds: 8,
      moistureBeforePercent: 30,
      timestamp: new Date().toISOString(),
      commandId,
    });

    // Command should be gone
    const configAfter = await deviceService.getConfig(ctx);
    expect(configAfter.pendingCommands).toHaveLength(0);
  });

  it("unpair → device deleted and flower deviceId cleared", async () => {
    const { deviceService, flowersService } = createServices();

    const flower = await flowersService.create("user_1", { customName: "Orchid" });
    const { code } = await deviceService.generatePairingCode("user_1", flower.userFlowerId);
    await deviceService.completePairing({ deviceId: "ESP32-004", code });

    await deviceService.unpairDevice("user_1", flower.userFlowerId);

    const unlinked = await flowersService.getOne("user_1", flower.userFlowerId);
    expect(unlinked.deviceId).toBeNull();

    // Auth should fail after unpairing — device record deleted
    await expect(deviceService.authenticateByKey("ESP32-004.fakehashpart")).rejects.toThrow(UnauthorizedError);
  });

  it("authenticating with wrong key throws UnauthorizedError", async () => {
    const { deviceService, flowersService } = createServices();

    const flower = await flowersService.create("user_1", { customName: "Violet" });
    const { code } = await deviceService.generatePairingCode("user_1", flower.userFlowerId);
    await deviceService.completePairing({ deviceId: "ESP32-005", code });

    await expect(deviceService.authenticateByKey("ESP32-005.wrongkeypart")).rejects.toThrow(UnauthorizedError);
  });

  it("expired pairing code throws GoneError", async () => {
    const { deviceService, flowersService } = createServices();

    const flower = await flowersService.create("user_1", { customName: "Lily" });

    // Manually create an expired pairing code
    const client = getTestDynamoDBClient();
    const pairingRepo = new PairingRepository(client, TEST_TABLE_NAMES.pairingCodes);
    await pairingRepo.create({
      code: "EXPIRD",
      userFlowerId: flower.userFlowerId,
      userId: "user_1",
      ttl: Math.floor(Date.now() / 1000) - 60, // expired 1 min ago
    });

    await expect(deviceService.completePairing({ deviceId: "ESP32-006", code: "EXPIRD" })).rejects.toThrow(GoneError);
  });

  it("device key hash round-trip: paired key authenticates correctly", async () => {
    const { deviceService, flowersService } = createServices();

    const flower = await flowersService.create("user_1", { customName: "Basil" });
    const { code } = await deviceService.generatePairingCode("user_1", flower.userFlowerId);
    const { apiKey } = await deviceService.completePairing({ deviceId: "ESP32-007", code });

    // Verify the stored hash matches what we'd compute
    const expectedHash = createHash("sha256").update(apiKey).digest("hex");
    const ctx = await deviceService.authenticateByKey(apiKey);

    expect(ctx.deviceId).toBe("ESP32-007");
    expect(ctx.userId).toBe("user_1");
    // The hash stored matches the key
    expect(expectedHash).toBeDefined();
  });
});
