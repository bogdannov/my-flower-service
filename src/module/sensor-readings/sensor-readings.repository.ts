import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { SensorReading } from "../../types";
import { BaseRepository } from "../db/base.repository";
import type { PaginatedResult } from "../db/base.repository";

interface GetByTimeRangeOptions {
  limit?: number;
  exclusiveStartKey?: Record<string, unknown>;
}

export class SensorReadingsRepository extends BaseRepository<SensorReading> {
  async create(reading: SensorReading): Promise<void> {
    await this.put({
      PK: reading.userFlowerId,
      SK: reading.timestamp,
      ...reading,
    });
  }

  async getByTimeRange(
    userFlowerId: string,
    from: string,
    to: string,
    options: GetByTimeRangeOptions = {},
  ): Promise<PaginatedResult<SensorReading>> {
    return this.query(
      "PK = :pk AND SK BETWEEN :from AND :to",
      { ":pk": userFlowerId, ":from": from, ":to": to },
      { scanIndexForward: true, limit: options.limit, exclusiveStartKey: options.exclusiveStartKey },
    );
  }

  async getLatest(userFlowerId: string): Promise<SensorReading | null> {
    const result = await this.query("PK = :pk", { ":pk": userFlowerId }, { scanIndexForward: false, limit: 1 });
    return result.items[0] ?? null;
  }
}
