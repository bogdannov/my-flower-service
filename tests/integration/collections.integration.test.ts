import { beforeEach, describe, expect, it } from "vitest";
import { CollectionsRepository } from "../../src/module/collections/collections.repository";
import { CollectionsService } from "../../src/module/collections/collections.service";
import { ValidationError } from "../../src/module/errors";
import { UserFlowersRepository } from "../../src/module/user-flowers/user-flowers.repository";
import { UserFlowersService } from "../../src/module/user-flowers/user-flowers.service";
import { TEST_TABLE_NAMES } from "./setup/tables";
import { clearTable, getTestDynamoDBClient } from "./setup/test-helpers";

const makeLogger = () => ({ debug: () => {}, info: () => {}, error: () => {}, warn: () => {} }) as never;

function createServices() {
  const client = getTestDynamoDBClient();
  const collectionsRepo = new CollectionsRepository(client, TEST_TABLE_NAMES.collections);
  const flowersRepo = new UserFlowersRepository(client, TEST_TABLE_NAMES.userFlowers);
  const collectionsService = new CollectionsService(collectionsRepo, flowersRepo, makeLogger());
  const flowersService = new UserFlowersService(flowersRepo, makeLogger());
  return { collectionsService, flowersService };
}

describe("Collections integration", () => {
  beforeEach(async () => {
    await Promise.all([clearTable(TEST_TABLE_NAMES.collections), clearTable(TEST_TABLE_NAMES.userFlowers)]);
  });

  it("creates a collection and retrieves it", async () => {
    const { collectionsService } = createServices();

    const created = await collectionsService.create("user_1", { name: "Living Room" });

    expect(created.collectionId).toMatch(/^col_/);
    expect(created.name).toBe("Living Room");
    expect(created.isDefault).toBe(false);
    expect(created.userFlowerIds).toEqual([]);

    const detail = await collectionsService.getDetail("user_1", created.collectionId);
    expect(detail.name).toBe("Living Room");
    expect(detail.flowers).toEqual([]);
  });

  it("adds a flower to a collection and returns enriched flower data in getDetail", async () => {
    const { collectionsService, flowersService } = createServices();

    const flower = await flowersService.create("user_1", { customName: "Orchid" });
    const collection = await collectionsService.create("user_1", { name: "Bedroom" });

    await collectionsService.addFlower("user_1", collection.collectionId, flower.userFlowerId);
    const detail = await collectionsService.getDetail("user_1", collection.collectionId);

    expect(detail.flowers).toHaveLength(1);
    expect(detail.flowers[0].userFlowerId).toBe(flower.userFlowerId);
    expect(detail.flowers[0].customName).toBe("Orchid");
  });

  it("removes flower from collection but keeps the flower itself", async () => {
    const { collectionsService, flowersService } = createServices();

    const flower = await flowersService.create("user_1", { customName: "Cactus" });
    const collection = await collectionsService.create("user_1", { name: "Office" });
    await collectionsService.addFlower("user_1", collection.collectionId, flower.userFlowerId);

    await collectionsService.removeFlower("user_1", collection.collectionId, flower.userFlowerId);

    const detail = await collectionsService.getDetail("user_1", collection.collectionId);
    expect(detail.flowers).toHaveLength(0);

    // Flower still exists
    const stillExists = await flowersService.getOne("user_1", flower.userFlowerId);
    expect(stillExists.userFlowerId).toBe(flower.userFlowerId);
  });

  it("auto-creates default collection on first list call", async () => {
    const { collectionsService } = createServices();

    const result = await collectionsService.list("user_1");

    expect(result).toHaveLength(1);
    expect(result[0].isDefault).toBe(true);
    expect(result[0].name).toBe("My Collection");
  });

  it("throws ValidationError when deleting default collection", async () => {
    const { collectionsService } = createServices();

    await collectionsService.list("user_1"); // triggers default creation
    const collections = await collectionsService.list("user_1");
    const defaultCol = collections.find((c) => c.isDefault);

    if (!defaultCol) throw new Error("Expected a default collection to exist");
    await expect(collectionsService.remove("user_1", defaultCol.collectionId)).rejects.toThrow(ValidationError);
  });

  it("successfully deletes a non-default collection", async () => {
    const { collectionsService } = createServices();

    const col = await collectionsService.create("user_1", { name: "Temp" });
    await collectionsService.remove("user_1", col.collectionId);

    const remaining = await collectionsService.getDetail("user_1", col.collectionId).catch((e) => e);
    expect(remaining.code).toBe("NOT_FOUND");
  });
});
