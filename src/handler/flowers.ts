import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { inject } from "../bootstrap/inject";
import { extractUserId } from "../module/auth/extract-user-id";
import { handleError } from "./error-handler";

const JSON_HEADERS = { "Content-Type": "application/json" };

export async function listFlowers(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    // Auth check — user must be authenticated
    extractUserId(event);

    const qs = event.queryStringParameters ?? {};
    const limit = qs.limit ? Number(qs.limit) : undefined;
    const cursor = qs.cursor;

    const service = await inject().FlowersService();
    const result = await service.list(limit, cursor);

    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify(result) };
  } catch (error) {
    return handleError(error);
  }
}

export async function getFlower(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    extractUserId(event);

    const id = event.pathParameters?.id;
    if (!id) {
      return {
        statusCode: 400,
        headers: JSON_HEADERS,
        body: JSON.stringify({ code: "VALIDATION_ERROR", message: "Missing flower id" }),
      };
    }

    const service = await inject().FlowersService();
    const result = await service.getById(id);

    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify(result) };
  } catch (error) {
    return handleError(error);
  }
}

export async function searchFlowers(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    extractUserId(event);

    const qs = event.queryStringParameters ?? {};
    const q = qs.q;

    if (!q || q.trim().length === 0) {
      return {
        statusCode: 400,
        headers: JSON_HEADERS,
        body: JSON.stringify({ code: "VALIDATION_ERROR", message: "Missing search query (q)" }),
      };
    }

    const limit = qs.limit ? Number(qs.limit) : undefined;
    const cursor = qs.cursor;

    const service = await inject().FlowersService();
    const result = await service.search(q.trim(), limit, cursor);

    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify(result) };
  } catch (error) {
    return handleError(error);
  }
}

// TODO: Integrate Plant.id API or vision model for real photo-based identification.
// Currently returns an empty array as a stub.
export async function photoSearchFlowers(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    extractUserId(event);

    const service = await inject().FlowersService();
    const results = await service.photoSearch(Buffer.from(event.body ?? ""));

    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify(results) };
  } catch (error) {
    return handleError(error);
  }
}
