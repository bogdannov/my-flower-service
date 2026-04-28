import { z } from "zod";

export const CollectionSchema = z.object({
  userId: z.string(),
  collectionId: z.string(),
  name: z.string().min(1).max(100),
  userFlowerIds: z.array(z.string()),
  isDefault: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Collection = z.infer<typeof CollectionSchema>;
