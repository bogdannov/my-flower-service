import { z } from "zod";
import { FlowerSchema } from "../entities/flower";

// FlowerResponse mirrors FlowerSchema exactly at the API boundary
export const FlowerResponseSchema = FlowerSchema;
export type FlowerResponse = z.infer<typeof FlowerResponseSchema>;

export const FlowerListResponseSchema = z.object({
  items: z.array(FlowerResponseSchema),
  nextCursor: z.string().nullable(),
  total: z.number().nullable(),
});
export type FlowerListResponse = z.infer<typeof FlowerListResponseSchema>;

// Search response has the same shape as the list response
export const FlowerSearchResponseSchema = FlowerListResponseSchema;
export type FlowerSearchResponse = z.infer<typeof FlowerSearchResponseSchema>;

// Photo search returns an ordered array of candidates (highest confidence first)
export const PhotoSearchResponseSchema = z.array(FlowerResponseSchema);
export type PhotoSearchResponse = z.infer<typeof PhotoSearchResponseSchema>;
