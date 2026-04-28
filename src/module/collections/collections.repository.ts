import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { Collection } from "../../types";
import { BaseRepository } from "../db/base.repository";

export class CollectionsRepository extends BaseRepository<Collection> {
  async findByUser(userId: string): Promise<Collection[]> {
    const result = await this.query("PK = :pk", { ":pk": userId });
    return result.items;
  }

  async findOne(userId: string, collectionId: string): Promise<Collection | null> {
    return this.get({ PK: userId, SK: collectionId });
  }

  async findDefault(userId: string): Promise<Collection | null> {
    const result = await this.query(
      "PK = :pk",
      { ":pk": userId },
      {
        filterExpression: "#isDefault = :isDefaultVal",
        expressionAttributeNames: { "#isDefault": "isDefault" },
        expressionAttributeValues: { ":isDefaultVal": true },
      },
    );
    return result.items[0] ?? null;
  }

  async create(collection: Collection): Promise<void> {
    await this.put({
      PK: collection.userId,
      SK: collection.collectionId,
      ...collection,
    });
  }

  async update(userId: string, collectionId: string, fields: Partial<Collection>): Promise<Collection> {
    const now = new Date().toISOString();
    const { userId: _u, collectionId: _id, ...rest } = fields;
    const fieldsWithTimestamp = { ...rest, updatedAt: now };

    const { updateExpression, expressionValues, expressionNames } = this.buildUpdateExpression(
      fieldsWithTimestamp as Record<string, unknown>,
    );

    return this.updateItem({ PK: userId, SK: collectionId }, updateExpression, expressionValues, expressionNames);
  }

  async remove(userId: string, collectionId: string): Promise<void> {
    await this.delete({ PK: userId, SK: collectionId });
  }
}
