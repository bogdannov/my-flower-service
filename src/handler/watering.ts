import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { inject } from "../bootstrap/inject";
import { extractUserId } from "../module/auth/extract-user-id";
import { CreateWateringEventRequestSchema } from "../types";
import { handleError } from "./error-handler";

const JSON_HEADERS = { "Content-Type": "application/json" };

export async function recordWatering(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const userId = extractUserId(event);
    const userFlowerId = event.pathParameters?.userFlowerId;

    if (!userFlowerId) {
      return {
        statusCode: 400,
        headers: JSON_HEADERS,
        body: JSON.stringify({ code: "VALIDATION_ERROR", message: "Missing userFlowerId" }),
      };
    }

    const parsed = CreateWateringEventRequestSchema.safeParse(JSON.parse(event.body ?? "{}"));

    if (!parsed.success) {
      return {
        statusCode: 400,
        headers: JSON_HEADERS,
        body: JSON.stringify({ code: "VALIDATION_ERROR", errors: parsed.error.flatten() }),
      };
    }

    const service = await inject().WateringService();
    const result = await service.recordManualWatering(userId, userFlowerId, parsed.data);

    return { statusCode: 201, headers: JSON_HEADERS, body: JSON.stringify(result) };
  } catch (error) {
    return handleError(error);
  }
}

export async function getWateringHistory(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const userId = extractUserId(event);
    const userFlowerId = event.pathParameters?.userFlowerId;

    if (!userFlowerId) {
      return {
        statusCode: 400,
        headers: JSON_HEADERS,
        body: JSON.stringify({ code: "VALIDATION_ERROR", message: "Missing userFlowerId" }),
      };
    }

    const qs = event.queryStringParameters ?? {};
    const limit = qs.limit ? Number(qs.limit) : undefined;
    const exclusiveStartKey = qs.exclusiveStartKey;

    const service = await inject().WateringService();
    const result = await service.getHistory(userId, userFlowerId, { limit, exclusiveStartKey });

    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify(result) };
  } catch (error) {
    return handleError(error);
  }
}
