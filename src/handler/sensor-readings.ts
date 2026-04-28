import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { inject } from "../bootstrap/inject";
import { extractUserId } from "../module/auth/extract-user-id";
import { GetSensorReadingsQuerySchema } from "../types";
import { handleError } from "./error-handler";

const JSON_HEADERS = { "Content-Type": "application/json" };

export async function getSensorReadings(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
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

    const parsed = GetSensorReadingsQuerySchema.safeParse(event.queryStringParameters ?? {});

    if (!parsed.success) {
      return {
        statusCode: 400,
        headers: JSON_HEADERS,
        body: JSON.stringify({ code: "VALIDATION_ERROR", errors: parsed.error.flatten() }),
      };
    }

    const service = await inject().SensorReadingsService();
    const result = await service.getReadings(userId, userFlowerId, parsed.data);

    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify(result) };
  } catch (error) {
    return handleError(error);
  }
}
