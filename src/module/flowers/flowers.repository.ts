import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { Flower } from "../../types";
import { BaseRepository } from "../db/base.repository";

export interface FlowersListResult {
  items: Flower[];
  lastEvaluatedKey?: Record<string, unknown>;
}

export class FlowersRepository extends BaseRepository<Flower> {
  constructor(client: DynamoDBDocumentClient, tableName: string) {
    super(client, tableName);
  }

  async findById(id: string): Promise<Flower | null> {
    return this.get({ PK: id });
  }

  async list(limit: number, exclusiveStartKey?: Record<string, unknown>): Promise<FlowersListResult> {
    const result = await this.client.send(
      new ScanCommand({
        TableName: this.tableName,
        Limit: limit,
        ExclusiveStartKey: exclusiveStartKey,
      }),
    );

    return {
      items: (result.Items as Flower[]) ?? [],
      lastEvaluatedKey: result.LastEvaluatedKey as Record<string, unknown> | undefined,
    };
  }

  async search(q: string, limit: number, exclusiveStartKey?: Record<string, unknown>): Promise<FlowersListResult> {
    const lowerQ = q.toLowerCase();

    const result = await this.client.send(
      new ScanCommand({
        TableName: this.tableName,
        Limit: limit,
        ExclusiveStartKey: exclusiveStartKey,
        FilterExpression:
          "contains(#lowerName, :q) OR contains(#lowerScientificName, :q) OR contains(#lowerCategory, :q)",
        ExpressionAttributeNames: {
          "#lowerName": "name",
          "#lowerScientificName": "scientificName",
          "#lowerCategory": "category",
        },
        ExpressionAttributeValues: {
          ":q": lowerQ,
        },
      }),
    );

    return {
      items: (result.Items as Flower[]) ?? [],
      lastEvaluatedKey: result.LastEvaluatedKey as Record<string, unknown> | undefined,
    };
  }

  async create(flower: Flower): Promise<void> {
    await this.put({ PK: flower.id, ...flower });
  }

  async batchCreate(flowers: Flower[]): Promise<void> {
    for (const flower of flowers) {
      await this.create(flower);
    }
  }
}
