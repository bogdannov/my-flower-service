import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { UserFlower } from "../../types";
import { BaseRepository } from "../db/base.repository";

export class UserFlowersRepository extends BaseRepository<UserFlower> {
  async findByUser(userId: string): Promise<UserFlower[]> {
    const result = await this.query("PK = :pk", { ":pk": userId });
    return result.items;
  }

  async findOne(userId: string, userFlowerId: string): Promise<UserFlower | null> {
    return this.get({ PK: userId, SK: userFlowerId });
  }

  async findByDeviceId(deviceId: string): Promise<UserFlower | null> {
    const result = await this.query(
      "#deviceId = :deviceId",
      { ":deviceId": deviceId },
      {
        indexName: "DeviceIndex",
        expressionAttributeNames: { "#deviceId": "deviceId" },
        limit: 1,
      },
    );
    return result.items[0] ?? null;
  }

  async create(flower: UserFlower): Promise<void> {
    const { deviceId, userId, userFlowerId, ...rest } = flower;
    const item: Record<string, unknown> = {
      PK: userId,
      SK: userFlowerId,
      userId,
      userFlowerId,
      ...rest,
      // Omit deviceId when null — DynamoDB rejects null values for GSI partition keys (DeviceIndex)
      ...(deviceId !== null && { deviceId }),
    };
    await this.put(item);
  }

  async update(userId: string, userFlowerId: string, fields: Partial<UserFlower>): Promise<UserFlower> {
    const now = new Date().toISOString();
    const { userId: _u, userFlowerId: _id, deviceId, ...rest } = fields;

    // Omit deviceId from SET fields — handle separately below (null means REMOVE from GSI key)
    const fieldsWithTimestamp: Record<string, unknown> = { ...rest, updatedAt: now };
    if (deviceId !== undefined && deviceId !== null) {
      fieldsWithTimestamp.deviceId = deviceId;
    }

    const { updateExpression, expressionValues, expressionNames } = this.buildUpdateExpression(fieldsWithTimestamp);

    // Unpairing: remove deviceId attribute so DynamoDB does not store null as a GSI partition key
    const finalExpression = deviceId === null ? `${updateExpression} REMOVE deviceId` : updateExpression;

    return this.updateItem({ PK: userId, SK: userFlowerId }, finalExpression, expressionValues, expressionNames);
  }

  async remove(userId: string, userFlowerId: string): Promise<void> {
    await this.delete({ PK: userId, SK: userFlowerId });
  }

  async batchGetByIds(userId: string, userFlowerIds: string[]): Promise<UserFlower[]> {
    const keys = userFlowerIds.map((id) => ({ PK: userId, SK: id }));
    return this.batchGet(keys);
  }
}
