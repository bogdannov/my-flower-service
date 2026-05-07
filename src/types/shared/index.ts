/**
 * Shared utility types consumed by the frontend.
 * These are plain TypeScript interfaces — no Zod schemas needed because
 * they are not validated server-side.
 */

/**
 * Generic cursor-paginated response wrapper.
 * Uses opaque string cursors so the client never needs to know the
 * pagination implementation detail.
 */
export interface PaginatedResponse<T> {
  items: T[];
  /** Opaque cursor for the next page. null means this is the last page. */
  nextCursor: string | null;
  /** Total item count across all pages. null when expensive to compute. */
  total: number | null;
}

/**
 * Standard API error shape returned by all endpoints.
 */
export interface ApiError {
  /** Human-readable error description */
  message: string;
  /** Machine-readable error code, e.g. "NOT_FOUND", "UNAUTHORIZED", "VALIDATION_ERROR" */
  code: string;
  /** HTTP status code equivalent, e.g. 404, 401, 422 */
  statusCode: number;
}
