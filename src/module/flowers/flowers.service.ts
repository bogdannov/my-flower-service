import type { Flower, FlowerListResponse, FlowerSearchResponse, PhotoSearchResponse } from "../../types";
import { NotFoundError } from "../errors";
import type { FlowersRepository } from "./flowers.repository";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export class FlowersService {
  constructor(private readonly repository: FlowersRepository) {}

  async list(limit?: number, cursor?: string): Promise<FlowerListResponse> {
    const resolvedLimit = Math.min(limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const exclusiveStartKey = cursor
      ? (JSON.parse(Buffer.from(cursor, "base64").toString("utf-8")) as Record<string, unknown>)
      : undefined;

    const result = await this.repository.list(resolvedLimit, exclusiveStartKey);

    const nextCursor = result.lastEvaluatedKey
      ? Buffer.from(JSON.stringify(result.lastEvaluatedKey)).toString("base64")
      : null;

    return { items: result.items, nextCursor, total: null };
  }

  async getById(id: string): Promise<Flower> {
    const flower = await this.repository.findById(id);
    if (!flower) throw new NotFoundError("Flower");
    return flower;
  }

  async search(q: string, limit?: number, cursor?: string): Promise<FlowerSearchResponse> {
    const resolvedLimit = Math.min(limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const exclusiveStartKey = cursor
      ? (JSON.parse(Buffer.from(cursor, "base64").toString("utf-8")) as Record<string, unknown>)
      : undefined;

    const result = await this.repository.search(q, resolvedLimit, exclusiveStartKey);

    const nextCursor = result.lastEvaluatedKey
      ? Buffer.from(JSON.stringify(result.lastEvaluatedKey)).toString("base64")
      : null;

    return { items: result.items, nextCursor, total: null };
  }

  // TODO: Integrate Plant.id API or vision model for real photo-based identification
  async photoSearch(_imageBuffer: Buffer): Promise<PhotoSearchResponse> {
    return [];
  }
}
