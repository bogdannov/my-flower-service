import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { inject } from "../../bootstrap/inject";
import type { DeviceContext } from "../device/device.service";
import { UnauthorizedError } from "../errors";

export async function extractDeviceContext(event: APIGatewayProxyEventV2): Promise<DeviceContext> {
  const apiKey = event.headers["x-device-key"] ?? event.headers["X-Device-Key"];

  if (!apiKey) {
    throw new UnauthorizedError("Missing device key");
  }

  const service = await inject().DeviceService();
  return service.authenticateByKey(apiKey);
}
