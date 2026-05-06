import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { inject } from "../bootstrap/inject";
import { extractDeviceContext } from "../module/auth/device-key.middleware";
import { extractUserId } from "../module/auth/extract-user-id";
import {
  DeviceSubmitReadingRequestSchema,
  DeviceWateringRequestSchema,
  ForceWaterRequestSchema,
  LinkDeviceToFlowerRequestSchema,
} from "../types";
import { handleError } from "./error-handler";

const JSON_HEADERS = { "Content-Type": "application/json" };

// ── Device API (X-Device-Key auth) ──

export async function submitReadings(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const deviceContext = await extractDeviceContext(event);

    const parsed = DeviceSubmitReadingRequestSchema.safeParse(JSON.parse(event.body ?? "{}"));

    if (!parsed.success) {
      return {
        statusCode: 400,
        headers: JSON_HEADERS,
        body: JSON.stringify({ code: "VALIDATION_ERROR", errors: parsed.error.flatten() }),
      };
    }

    const service = await inject().DeviceService();
    await service.submitReading(deviceContext, parsed.data);

    return { statusCode: 201, body: "" };
  } catch (error) {
    return handleError(error);
  }
}

export async function submitWatering(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const deviceContext = await extractDeviceContext(event);

    const parsed = DeviceWateringRequestSchema.safeParse(JSON.parse(event.body ?? "{}"));

    if (!parsed.success) {
      return {
        statusCode: 400,
        headers: JSON_HEADERS,
        body: JSON.stringify({ code: "VALIDATION_ERROR", errors: parsed.error.flatten() }),
      };
    }

    const service = await inject().DeviceService();
    await service.submitWatering(deviceContext, parsed.data);

    return { statusCode: 201, body: "" };
  } catch (error) {
    return handleError(error);
  }
}

export async function getConfig(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const deviceContext = await extractDeviceContext(event);
    const service = await inject().DeviceService();
    const result = await service.getConfig(deviceContext);

    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify(result) };
  } catch (error) {
    return handleError(error);
  }
}

// ── User API (Auth0 JWT auth) ──

export async function linkToFlower(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
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

    const parsed = LinkDeviceToFlowerRequestSchema.safeParse(JSON.parse(event.body ?? "{}"));

    if (!parsed.success) {
      return {
        statusCode: 400,
        headers: JSON_HEADERS,
        body: JSON.stringify({ code: "VALIDATION_ERROR", errors: parsed.error.flatten() }),
      };
    }

    const service = await inject().DeviceService();
    const result = await service.linkToFlower(userId, userFlowerId, parsed.data);

    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify(result) };
  } catch (error) {
    return handleError(error);
  }
}

export async function unpairDevice(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
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

    const service = await inject().DeviceService();
    await service.unpairDevice(userId, userFlowerId);

    return { statusCode: 204, body: "" };
  } catch (error) {
    return handleError(error);
  }
}

export async function getDeviceStatus(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
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

    const service = await inject().DeviceService();
    const result = await service.getDeviceStatus(userId, userFlowerId);

    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify(result) };
  } catch (error) {
    return handleError(error);
  }
}

export async function forceWater(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
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

    const parsed = ForceWaterRequestSchema.safeParse(JSON.parse(event.body ?? "{}"));

    if (!parsed.success) {
      return {
        statusCode: 400,
        headers: JSON_HEADERS,
        body: JSON.stringify({ code: "VALIDATION_ERROR", errors: parsed.error.flatten() }),
      };
    }

    const service = await inject().DeviceService();
    const result = await service.forceWater(userId, userFlowerId, parsed.data);

    // 202 Accepted — command is queued, not immediately executed
    return { statusCode: 202, headers: JSON_HEADERS, body: JSON.stringify(result) };
  } catch (error) {
    return handleError(error);
  }
}
