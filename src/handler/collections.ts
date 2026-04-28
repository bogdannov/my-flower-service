import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { inject } from "../bootstrap/inject";
import { extractUserId } from "../module/auth/extract-user-id";
import { CreateCollectionRequestSchema, UpdateCollectionRequestSchema } from "../types";
import { handleError } from "./error-handler";

const JSON_HEADERS = { "Content-Type": "application/json" };

export async function createCollection(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const userId = extractUserId(event);
    const parsed = CreateCollectionRequestSchema.safeParse(JSON.parse(event.body ?? "{}"));

    if (!parsed.success) {
      return {
        statusCode: 400,
        headers: JSON_HEADERS,
        body: JSON.stringify({ code: "VALIDATION_ERROR", errors: parsed.error.flatten() }),
      };
    }

    const service = await inject().CollectionsService();
    const result = await service.create(userId, parsed.data);

    return { statusCode: 201, headers: JSON_HEADERS, body: JSON.stringify(result) };
  } catch (error) {
    return handleError(error);
  }
}

export async function listCollections(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const userId = extractUserId(event);
    const service = await inject().CollectionsService();
    const result = await service.list(userId);

    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify(result) };
  } catch (error) {
    return handleError(error);
  }
}

export async function getCollection(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const userId = extractUserId(event);
    const collectionId = event.pathParameters?.collectionId;

    if (!collectionId) {
      return {
        statusCode: 400,
        headers: JSON_HEADERS,
        body: JSON.stringify({ code: "VALIDATION_ERROR", message: "Missing collectionId" }),
      };
    }

    const service = await inject().CollectionsService();
    const result = await service.getDetail(userId, collectionId);

    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify(result) };
  } catch (error) {
    return handleError(error);
  }
}

export async function updateCollection(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const userId = extractUserId(event);
    const collectionId = event.pathParameters?.collectionId;

    if (!collectionId) {
      return {
        statusCode: 400,
        headers: JSON_HEADERS,
        body: JSON.stringify({ code: "VALIDATION_ERROR", message: "Missing collectionId" }),
      };
    }

    const parsed = UpdateCollectionRequestSchema.safeParse(JSON.parse(event.body ?? "{}"));

    if (!parsed.success) {
      return {
        statusCode: 400,
        headers: JSON_HEADERS,
        body: JSON.stringify({ code: "VALIDATION_ERROR", errors: parsed.error.flatten() }),
      };
    }

    const service = await inject().CollectionsService();
    const result = await service.update(userId, collectionId, parsed.data);

    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify(result) };
  } catch (error) {
    return handleError(error);
  }
}

export async function deleteCollection(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const userId = extractUserId(event);
    const collectionId = event.pathParameters?.collectionId;

    if (!collectionId) {
      return {
        statusCode: 400,
        headers: JSON_HEADERS,
        body: JSON.stringify({ code: "VALIDATION_ERROR", message: "Missing collectionId" }),
      };
    }

    const service = await inject().CollectionsService();
    await service.remove(userId, collectionId);

    return { statusCode: 204, body: "" };
  } catch (error) {
    return handleError(error);
  }
}

export async function addFlowerToCollection(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const userId = extractUserId(event);
    const { collectionId, userFlowerId } = event.pathParameters ?? {};

    if (!collectionId || !userFlowerId) {
      return {
        statusCode: 400,
        headers: JSON_HEADERS,
        body: JSON.stringify({ code: "VALIDATION_ERROR", message: "Missing collectionId or userFlowerId" }),
      };
    }

    const service = await inject().CollectionsService();
    const result = await service.addFlower(userId, collectionId, userFlowerId);

    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify(result) };
  } catch (error) {
    return handleError(error);
  }
}

export async function removeFlowerFromCollection(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const userId = extractUserId(event);
    const { collectionId, userFlowerId } = event.pathParameters ?? {};

    if (!collectionId || !userFlowerId) {
      return {
        statusCode: 400,
        headers: JSON_HEADERS,
        body: JSON.stringify({ code: "VALIDATION_ERROR", message: "Missing collectionId or userFlowerId" }),
      };
    }

    const service = await inject().CollectionsService();
    const result = await service.removeFlower(userId, collectionId, userFlowerId);

    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify(result) };
  } catch (error) {
    return handleError(error);
  }
}
