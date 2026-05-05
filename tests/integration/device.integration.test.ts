import { createHash, randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import type { ConfigType } from "../../src/module/config/Config";
import { DeviceService } from "../../src/module/device/device.service";
import { DevicesRepository } from "../../src/module/device/devices.repository";
import { ConflictError, NotFoundError, UnauthorizedError } from "../../src/module/errors";
import { SensorReadingsRepository } from "../../src/module/sensor-readings/sensor-readings.repository";
import { SensorReadingsService } from "../../src/module/sensor-readings/sensor-readings.service";
import { UserFlowersRepository } from "../../src/module/user-flowers/user-flowers.repository";
import { UserFlowersService } from "../../src/module/user-flowers/user-flowers.service";
import { WateringRepository } from "../../src/module/watering/watering.repository";
import { WateringService } from "../../src/module/watering/watering.service";
import type { Device } from "../../src/types";
import { TEST_TABLE_NAMES } from "./setup/tables";
import { clearTable, getTestDynamoDBClient } from "./setup/test-helpers";

const makeLogger = () => ({ debug: () => {}, info: () => {}, error: () => {}, warn: () => {} }) as never;

const testConfig: ConfigType = {
  SENSOR_READINGS_TTL_DAYS: 30,
  LATEST_FIRMWARE_VERSION: "1.1.0",
  LATEST_FIRMWARE_URL: "https://example.com/firmware.bin",
  LATEST_FIRMWARE_CHECKSUM: "abc123checksum",
} as ConfigType;

function provisionDevice(deviceId: string): { device: Device; rawApiKey: string } {
  const rawApiKey = `${deviceId}.${randomBytes(32).toString("hex")}`;
  const apiKeyHash = createHash("sha256").update(rawApiKey).digest("hex");
  const device: Device = {
    deviceId,
    userFlowerId: null,
    userId: null,
    apiKeyHash,
    status: "unlinked",
    firmwareVersion: null,
    pairedAt: null,
    lastSeenAt: null,
  };
  return { device, rawApiKey };
}

function createServices() {
  const client = getTestDynamoDBClient();
  const flowersRepo = new UserFlowersRepository(client, TEST_TABLE_NAMES.userFlowers);
  const wateringRepo = new WateringRepository(client, TEST_TABLE_NAMES.wateringEvents);
  const readingsRepo = new SensorReadingsRepository(client, TEST_TABLE_NAMES.sensorReadings);
  const devicesRepo = new DevicesRepository(client, TEST_TABLE_NAMES.devices);
  const flowersService = new UserFlowersService(flowersRepo, makeLogger());
  const wateringService = new WateringService(wateringRepo, flowersService, makeLogger());
  const readingsService = new SensorReadingsService(readingsRepo, flowersService, testConfig, makeLogger());
  const deviceService = new DeviceService(
    devicesRepo,
    flowersService,
    wateringService,
    readingsService,
    testConfig,
    makeLogger(),
  );
  return { deviceService, flowersService, devicesRepo, readingsService };
}

describe("Device integration", () => {
  beforeEach(async () => {
    await Promise.all([
      clearTable(TEST_TABLE_NAMES.userFlowers),
      clearTable(TEST_TABLE_NAMES.wateringEvents),
      clearTable(TEST_TABLE_NAMES.sensorReadings),
      clearTable(TEST_TABLE_NAMES.devices),
    ]);
  });

  it("full activation flow: provision → boot → linkToFlower → config with settings", async () => {
    const { deviceService, flowersService, devicesRepo } = createServices();

    // Stage 1: factory provisioning
    const { device, rawApiKey } = provisionDevice("mf-00001");
    await devicesRepo.create(device);

    // Stage 2: device boots for the first time
    const bootResult = await deviceService.boot(rawApiKey, { firmwareVersion: "1.0.0" });
    expect(bootResult.status).toBe("unlinked");
    expect(bootResult.config).toBeUndefined();

    // Verify DB status is "online" after boot
    const afterBoot = await devicesRepo.findByDeviceId("mf-00001");
    expect(afterBoot?.status).toBe("online");
    expect(afterBoot?.firmwareVersion).toBe("1.0.0");
    expect(afterBoot?.lastSeenAt).not.toBeNull();

    // Stage 3: user links device to their flower
    const flower = await flowersService.create("user_1", { customName: "Monstera" });
    const linkResult = await deviceService.linkToFlower("user_1", flower.userFlowerId, { deviceId: "mf-00001" });

    expect(linkResult.deviceId).toBe("mf-00001");
    expect(linkResult.status).toBe("linked");

    // Verify DB state after linking
    const afterLink = await devicesRepo.findByDeviceId("mf-00001");
    expect(afterLink?.status).toBe("linked");
    expect(afterLink?.userFlowerId).toBe(flower.userFlowerId);
    expect(afterLink?.userId).toBe("user_1");
    expect(afterLink?.pairedAt).not.toBeNull();

    // Device polling config gets real settings + firmwareUpdate
    const ctx = await deviceService.authenticateByKey(rawApiKey);
    const config = await deviceService.getConfig(ctx);

    expect(config.settings).toBeDefined();
    expect(config.pendingCommands).toHaveLength(0);
    // firmware update available: device is on 1.0.0, latest is 1.1.0
    expect(config.firmwareUpdate.available).toBe(true);
    expect(config.firmwareUpdate.version).toBe("1.1.0");
  });

  it("boot on already-linked device returns { status: 'linked', config }", async () => {
    const { deviceService, flowersService, devicesRepo } = createServices();

    const { device, rawApiKey } = provisionDevice("mf-00002");
    await devicesRepo.create(device);
    await deviceService.boot(rawApiKey, { firmwareVersion: "1.0.0" });

    const flower = await flowersService.create("user_1", { customName: "Cactus" });
    await deviceService.linkToFlower("user_1", flower.userFlowerId, { deviceId: "mf-00002" });

    // Second boot after linking
    const bootResult = await deviceService.boot(rawApiKey, { firmwareVersion: "1.0.0" });
    expect(bootResult.status).toBe("linked");
    expect(bootResult.config).toBeDefined();
    expect(bootResult.config?.firmwareUpdate).toBeDefined();
  });

  it("firmwareUpdate.available is false when firmware is up to date", async () => {
    const { deviceService, flowersService, devicesRepo } = createServices();

    const { device, rawApiKey } = provisionDevice("mf-00003");
    await devicesRepo.create(device);
    await deviceService.boot(rawApiKey, { firmwareVersion: "1.1.0" }); // same as latest

    const flower = await flowersService.create("user_1", { customName: "Rose" });
    await deviceService.linkToFlower("user_1", flower.userFlowerId, { deviceId: "mf-00003" });

    const ctx = await deviceService.authenticateByKey(rawApiKey);
    const config = await deviceService.getConfig(ctx);

    expect(config.firmwareUpdate.available).toBe(false);
    expect(config.firmwareUpdate.version).toBeUndefined();
  });

  it("linkToFlower is idempotent — linking same device to same flower twice returns success", async () => {
    const { deviceService, flowersService, devicesRepo } = createServices();

    const { device, rawApiKey } = provisionDevice("mf-00004");
    await devicesRepo.create(device);
    await deviceService.boot(rawApiKey, { firmwareVersion: "1.0.0" });

    const flower = await flowersService.create("user_1", { customName: "Fern" });
    await deviceService.linkToFlower("user_1", flower.userFlowerId, { deviceId: "mf-00004" });

    // Second call — must not throw
    const result = await deviceService.linkToFlower("user_1", flower.userFlowerId, { deviceId: "mf-00004" });
    expect(result.status).toBe("linked");
  });

  it("linkToFlower throws ConflictError when device is already linked to a different flower", async () => {
    const { deviceService, flowersService, devicesRepo } = createServices();

    const { device, rawApiKey } = provisionDevice("mf-00005");
    await devicesRepo.create(device);
    await deviceService.boot(rawApiKey, { firmwareVersion: "1.0.0" });

    const flower1 = await flowersService.create("user_1", { customName: "Orchid" });
    const flower2 = await flowersService.create("user_1", { customName: "Lily" });

    await deviceService.linkToFlower("user_1", flower1.userFlowerId, { deviceId: "mf-00005" });

    await expect(deviceService.linkToFlower("user_1", flower2.userFlowerId, { deviceId: "mf-00005" })).rejects.toThrow(
      ConflictError,
    );
  });

  it("linkToFlower throws NotFoundError for non-existent device", async () => {
    const { deviceService, flowersService } = createServices();

    const flower = await flowersService.create("user_1", { customName: "Basil" });

    await expect(deviceService.linkToFlower("user_1", flower.userFlowerId, { deviceId: "mf-99999" })).rejects.toThrow(
      NotFoundError,
    );
  });

  it("submit reading after linking → sensor reading stored and snapshot updated", async () => {
    const { deviceService, flowersService, devicesRepo, readingsService } = createServices();

    const { device, rawApiKey } = provisionDevice("mf-00006");
    await devicesRepo.create(device);
    await deviceService.boot(rawApiKey, { firmwareVersion: "1.0.0" });

    const flower = await flowersService.create("user_1", { customName: "Violet" });
    await deviceService.linkToFlower("user_1", flower.userFlowerId, { deviceId: "mf-00006" });

    const ctx = await deviceService.authenticateByKey(rawApiKey);
    await deviceService.submitReading(ctx, { moisturePercent: 65, rawValue: 2800 });

    const updated = await flowersService.getOne("user_1", flower.userFlowerId);
    expect(updated.lastMoisturePercent).toBe(65);
    expect(updated.lastReadingAt).not.toBeNull();

    const readings = await readingsService.getReadings("user_1", flower.userFlowerId, {});
    expect(readings.items).toHaveLength(1);
    expect(readings.items[0].moisturePercent).toBe(65);
  });

  it("force water → get config → command in pendingCommands → submit watering removes command", async () => {
    const { deviceService, flowersService, devicesRepo } = createServices();

    const { device, rawApiKey } = provisionDevice("mf-00007");
    await devicesRepo.create(device);
    await deviceService.boot(rawApiKey, { firmwareVersion: "1.0.0" });

    const flower = await flowersService.create("user_1", { customName: "Aloe" });
    await deviceService.linkToFlower("user_1", flower.userFlowerId, { deviceId: "mf-00007" });

    const { commandId } = await deviceService.forceWater("user_1", flower.userFlowerId, { durationSeconds: 8 });
    expect(commandId).toMatch(/^cmd_/);

    const ctx = await deviceService.authenticateByKey(rawApiKey);
    const config = await deviceService.getConfig(ctx);
    expect(config.pendingCommands).toHaveLength(1);
    expect(config.pendingCommands[0].commandId).toBe(commandId);

    await deviceService.submitWatering(ctx, {
      source: "force",
      durationSeconds: 8,
      moistureBeforePercent: 30,
      timestamp: new Date().toISOString(),
      commandId,
    });

    const configAfter = await deviceService.getConfig(ctx);
    expect(configAfter.pendingCommands).toHaveLength(0);
  });

  it("unpairDevice resets device to 'online' — record stays in DB, flower deviceId cleared", async () => {
    const { deviceService, flowersService, devicesRepo } = createServices();

    const { device, rawApiKey } = provisionDevice("mf-00008");
    await devicesRepo.create(device);
    await deviceService.boot(rawApiKey, { firmwareVersion: "1.0.0" });

    const flower = await flowersService.create("user_1", { customName: "Succulent" });
    await deviceService.linkToFlower("user_1", flower.userFlowerId, { deviceId: "mf-00008" });

    await deviceService.unpairDevice("user_1", flower.userFlowerId);

    // Flower deviceId cleared
    const unlinked = await flowersService.getOne("user_1", flower.userFlowerId);
    expect(unlinked.deviceId).toBeNull();

    // Device record still exists — just reset to "online"
    const deviceAfterUnpair = await devicesRepo.findByDeviceId("mf-00008");
    expect(deviceAfterUnpair).not.toBeNull();
    expect(deviceAfterUnpair?.status).toBe("online");
    expect(deviceAfterUnpair?.userFlowerId).toBeNull();
    expect(deviceAfterUnpair?.userId).toBeNull();
    expect(deviceAfterUnpair?.pairedAt).toBeNull();

    // Device can still authenticate (key is unchanged)
    const ctx = await deviceService.authenticateByKey(rawApiKey);
    expect(ctx.deviceId).toBe("mf-00008");
    expect(ctx.userFlowerId).toBeNull();
  });

  it("authenticating with wrong key throws UnauthorizedError", async () => {
    const { deviceService, devicesRepo } = createServices();

    const { device } = provisionDevice("mf-00009");
    await devicesRepo.create(device);

    await expect(deviceService.authenticateByKey("mf-00009.wrongkeypart")).rejects.toThrow(UnauthorizedError);
  });

  it("device key hash round-trip: provisioned key authenticates correctly", async () => {
    const { deviceService, devicesRepo } = createServices();

    const { device, rawApiKey } = provisionDevice("mf-00010");
    await devicesRepo.create(device);

    const ctx = await deviceService.authenticateByKey(rawApiKey);
    expect(ctx.deviceId).toBe("mf-00010");
    expect(ctx.userFlowerId).toBeNull();
  });
});
