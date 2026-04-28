import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { inject } from "../bootstrap/inject";
import { extractUserId } from "../module/auth/extract-user-id";
import { CreateUserFlowerRequestSchema, UpdateUserFlowerRequestSchema } from "../types";
import { handleError } from "./error-handler";

const JSON_HEADERS = { "Content-Type": "application/json" };

export async function createUserFlower(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const userId = extractUserId(event);
    const parsed = CreateUserFlowerRequestSchema.safeParse(JSON.parse(event.body ?? "{}"));

    if (!parsed.success) {
      return {
        statusCode: 400,
        headers: JSON_HEADERS,
        body: JSON.stringify({ code: "VALIDATION_ERROR", errors: parsed.error.flatten() }),
      };
    }

    const service = await inject().UserFlowersService();
    const result = await service.create(userId, parsed.data);

    return { statusCode: 201, headers: JSON_HEADERS, body: JSON.stringify(result) };
  } catch (error) {
    return handleError(error);
  }
}

export async function listUserFlowers(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const userId = extractUserId(event);
    const service = await inject().UserFlowersService();
    const result = await service.list(userId);

    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify(result) };
  } catch (error) {
    return handleError(error);
  }
}

export async function getUserFlower(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
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

    const service = await inject().UserFlowersService();
    const result = await service.getOne(userId, userFlowerId);

    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify(result) };
  } catch (error) {
    return handleError(error);
  }
}

export async function updateUserFlower(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
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

    const parsed = UpdateUserFlowerRequestSchema.safeParse(JSON.parse(event.body ?? "{}"));

    if (!parsed.success) {
      return {
        statusCode: 400,
        headers: JSON_HEADERS,
        body: JSON.stringify({ code: "VALIDATION_ERROR", errors: parsed.error.flatten() }),
      };
    }

    const service = await inject().UserFlowersService();
    const result = await service.update(userId, userFlowerId, parsed.data);

    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify(result) };
  } catch (error) {
    return handleError(error);
  }
}

export async function deleteUserFlower(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
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

    const service = await inject().UserFlowersService();
    await service.remove(userId, userFlowerId);

    return { statusCode: 204, body: "" };
  } catch (error) {
    return handleError(error);
  }
}
