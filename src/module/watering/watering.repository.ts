import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { WateringEvent } from "../../types";
import { BaseRepository } from "../db/base.repository";
import type { PaginatedResult } from "../db/base.repository";

interface GetHistoryOptions {
  limit?: number;
  exclusiveStartKey?: Record<string, unknown>;
  from?: string;
  to?: string;
}

export class WateringRepository extends BaseRepository<WateringEvent> {
  async create(event: WateringEvent): Promise<void> {
    await this.put({
      PK: event.userFlowerId,
      SK: event.timestamp,
      ...event,
    });
  }

  async getHistory(userFlowerId: string, options: GetHistoryOptions = {}): Promise<PaginatedResult<WateringEvent>> {
    const { limit, exclusiveStartKey, from, to } = options;

    if (from && to) {
      return this.query(
        "PK = :pk AND SK BETWEEN :from AND :to",
        { ":pk": userFlowerId, ":from": from, ":to": to },
        { scanIndexForward: false, limit, exclusiveStartKey },
      );
    }

    return this.query("PK = :pk", { ":pk": userFlowerId }, { scanIndexForward: false, limit, exclusiveStartKey });
  }

  async getLatest(userFlowerId: string): Promise<WateringEvent | null> {
    const result = await this.query("PK = :pk", { ":pk": userFlowerId }, { scanIndexForward: false, limit: 1 });
    return result.items[0] ?? null;
  }
}
