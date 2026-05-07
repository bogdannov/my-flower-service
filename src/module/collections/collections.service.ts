import { ulid } from "ulid";
import type { Logger } from "winston";
import type {
  Collection,
  CollectionDetailResponse,
  CollectionListResponse,
  CollectionResponse,
  CreateCollectionRequest,
  UpdateCollectionRequest,
  UserFlower,
  UserFlowerResponse,
} from "../../types";
import { NotFoundError, ValidationError } from "../errors";
import type { UserFlowersRepository } from "../user-flowers/user-flowers.repository";
import type { CollectionsRepository } from "./collections.repository";

export class CollectionsService {
  constructor(
    private readonly collectionsRepository: CollectionsRepository,
    private readonly userFlowersRepository: UserFlowersRepository,
    private readonly logger: Logger,
  ) {}

  async create(userId: string, request: CreateCollectionRequest): Promise<CollectionResponse> {
    const now = new Date().toISOString();
    const collection: Collection = {
      userId,
      collectionId: `col_${ulid()}`,
      name: request.name,
      description: request.description ?? null,
      userFlowerIds: [],
      isDefault: false,
      createdAt: now,
      updatedAt: now,
    };

    await this.collectionsRepository.create(collection);
    this.logger.debug("Collection created", { userId, collectionId: collection.collectionId });

    return this.toResponse(collection);
  }

  async list(userId: string): Promise<CollectionListResponse> {
    const collections = await this.collectionsRepository.findByUser(userId);

    if (collections.length === 0) {
      await this.ensureDefaultCollection(userId);
      const withDefault = await this.collectionsRepository.findByUser(userId);
      return withDefault.map((c) => this.toResponse(c));
    }

    return collections.map((c) => this.toResponse(c));
  }

  async getDetail(userId: string, collectionId: string): Promise<CollectionDetailResponse> {
    const collection = await this.collectionsRepository.findOne(userId, collectionId);
    if (!collection) throw new NotFoundError("Collection");

    const flowers: UserFlowerResponse[] =
      collection.userFlowerIds.length > 0
        ? (await this.userFlowersRepository.batchGetByIds(userId, collection.userFlowerIds)).map((f) =>
            this.toFlowerResponse(f),
          )
        : [];

    return { ...this.toResponse(collection), flowers };
  }

  async update(userId: string, collectionId: string, request: UpdateCollectionRequest): Promise<CollectionResponse> {
    const existing = await this.collectionsRepository.findOne(userId, collectionId);
    if (!existing) throw new NotFoundError("Collection");

    const fields: Partial<Collection> = {};
    if (request.name !== undefined) fields.name = request.name;
    if (request.description !== undefined) fields.description = request.description;

    const updated = await this.collectionsRepository.update(userId, collectionId, fields);
    return this.toResponse(updated);
  }

  async remove(userId: string, collectionId: string): Promise<void> {
    const existing = await this.collectionsRepository.findOne(userId, collectionId);
    if (!existing) throw new NotFoundError("Collection");

    if (existing.isDefault) {
      throw new ValidationError("Cannot delete default collection");
    }

    await this.collectionsRepository.remove(userId, collectionId);
    this.logger.debug("Collection removed", { userId, collectionId });
  }

  async addFlower(userId: string, collectionId: string, userFlowerId: string): Promise<CollectionResponse> {
    const collection = await this.collectionsRepository.findOne(userId, collectionId);
    if (!collection) throw new NotFoundError("Collection");

    const flower = await this.userFlowersRepository.findOne(userId, userFlowerId);
    if (!flower) throw new NotFoundError("UserFlower");

    if (collection.userFlowerIds.includes(userFlowerId)) {
      return this.toResponse(collection);
    }

    const updated = await this.collectionsRepository.update(userId, collectionId, {
      userFlowerIds: [...collection.userFlowerIds, userFlowerId],
    });
    return this.toResponse(updated);
  }

  async removeFlower(userId: string, collectionId: string, userFlowerId: string): Promise<CollectionResponse> {
    const collection = await this.collectionsRepository.findOne(userId, collectionId);
    if (!collection) throw new NotFoundError("Collection");

    const updated = await this.collectionsRepository.update(userId, collectionId, {
      userFlowerIds: collection.userFlowerIds.filter((id) => id !== userFlowerId),
    });
    return this.toResponse(updated);
  }

  async ensureDefaultCollection(userId: string): Promise<void> {
    const existing = await this.collectionsRepository.findDefault(userId);
    if (existing) return;

    const now = new Date().toISOString();
    await this.collectionsRepository.create({
      userId,
      collectionId: `col_${ulid()}`,
      name: "My Collection",
      description: null,
      userFlowerIds: [],
      isDefault: true,
      createdAt: now,
      updatedAt: now,
    });
    this.logger.debug("Default collection created", { userId });
  }

  private toResponse(collection: Collection): CollectionResponse {
    return {
      collectionId: collection.collectionId,
      name: collection.name,
      description: collection.description,
      userFlowerIds: collection.userFlowerIds,
      isDefault: collection.isDefault,
      createdAt: collection.createdAt,
      updatedAt: collection.updatedAt,
    };
  }

  private toFlowerResponse(flower: UserFlower): UserFlowerResponse {
    return {
      userFlowerId: flower.userFlowerId,
      customName: flower.customName,
      flowerId: flower.flowerId,
      settings: flower.settings,
      lastMoisturePercent: flower.lastMoisturePercent,
      lastReadingAt: flower.lastReadingAt,
      lastWateredAt: flower.lastWateredAt,
      deviceId: flower.deviceId,
      createdAt: flower.createdAt,
      updatedAt: flower.updatedAt,
    };
  }
}
