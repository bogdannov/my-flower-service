import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { inject } from "../bootstrap/inject";
import { extractUserId } from "../module/auth/extract-user-id";
import { AiAskRequestSchema } from "../types";
import { handleError } from "./error-handler";

const JSON_HEADERS = { "Content-Type": "application/json" };

export async function askAI(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    extractUserId(event);

    const parsed = AiAskRequestSchema.safeParse(JSON.parse(event.body ?? "{}"));

    if (!parsed.success) {
      return {
        statusCode: 400,
        headers: JSON_HEADERS,
        body: JSON.stringify({ code: "VALIDATION_ERROR", errors: parsed.error.flatten() }),
      };
    }

    const service = await inject().AiService();
    const answer = await service.ask(parsed.data);

    return {
      statusCode: 200,
      headers: JSON_HEADERS,
      body: JSON.stringify({ answer, flowerId: parsed.data.flowerId }),
    };
  } catch (error) {
    return handleError(error);
  }
}
