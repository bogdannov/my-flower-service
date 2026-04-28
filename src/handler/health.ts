import type { APIGatewayProxyHandler, APIGatewayProxyResult } from "aws-lambda";
import { inject } from "../bootstrap/inject";

export const handler: APIGatewayProxyHandler = async (_event): Promise<APIGatewayProxyResult> => {
  try {
    const config = await inject().Config();
    await inject().DynamoDBClient();

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "ok",
        stage: config.get().STAGE,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (_error) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "error",
        message: "Service unhealthy",
      }),
    };
  }
};
