import { z } from "zod";
import { UserFlowerResponseSchema } from "./user-flowers.api";

// ── Requests ──

export const CreateCollectionRequestSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

export const UpdateCollectionRequestSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
});

// ── Responses ──

export const CollectionResponseSchema = z.object({
  collectionId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  userFlowerIds: z.array(z.string()),
  isDefault: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const CollectionDetailResponseSchema = CollectionResponseSchema.extend({
  flowers: z.array(UserFlowerResponseSchema),
});

// ── Inferred Types ──

export type CreateCollectionRequest = z.infer<typeof CreateCollectionRequestSchema>;
export type UpdateCollectionRequest = z.infer<typeof UpdateCollectionRequestSchema>;
export type CollectionResponse = z.infer<typeof CollectionResponseSchema>;
export type CollectionDetailResponse = z.infer<typeof CollectionDetailResponseSchema>;
export type CollectionListResponse = CollectionResponse[];
