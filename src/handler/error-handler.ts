import type { APIGatewayProxyResultV2 } from "aws-lambda";
import { AppError } from "../module/errors";

export function handleError(error: unknown): APIGatewayProxyResultV2 {
  if (error instanceof AppError) {
    return {
      statusCode: error.statusCode,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: error.code, message: error.message }),
    };
  }

  console.error("Unhandled error", { error });
  return {
    statusCode: 500,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: "INTERNAL_ERROR", message: "Internal server error" }),
  };
}
