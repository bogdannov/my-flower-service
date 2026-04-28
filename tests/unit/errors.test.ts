import { describe, expect, it } from "vitest";
import {
  AppError,
  ConflictError,
  GoneError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "../../src/module/errors";

describe("AppError hierarchy", () => {
  it("NotFoundError has correct statusCode and message", () => {
    const err = new NotFoundError("Collection");
    expect(err.message).toBe("Collection not found");
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe("NOT_FOUND");
    expect(err instanceof AppError).toBe(true);
  });

  it("ValidationError accepts optional details", () => {
    const err = new ValidationError("Invalid input", { field: "name" });
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe("VALIDATION_ERROR");
    expect(err.details).toEqual({ field: "name" });
  });

  it("ValidationError works without details", () => {
    const err = new ValidationError("Bad request");
    expect(err.details).toBeUndefined();
  });

  it("UnauthorizedError has 401", () => {
    const err = new UnauthorizedError("Unauthorized");
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe("UNAUTHORIZED");
  });

  it("ConflictError has 409", () => {
    const err = new ConflictError("Conflict");
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe("CONFLICT");
  });

  it("GoneError has 410", () => {
    const err = new GoneError("Gone");
    expect(err.statusCode).toBe(410);
    expect(err.code).toBe("GONE");
  });
});
