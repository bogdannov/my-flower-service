import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { UnauthorizedError } from "../errors";

// API Gateway HTTP API v2 JWT authorizer populates this context at runtime,
// but the base type doesn't include it — so we extend it here.
interface JwtAuthorizerContext {
  authorizer?: {
    jwt?: {
      claims?: Record<string, string | number | boolean | string[]>;
    };
  };
}

// In production with API Gateway HTTP API + JWT authorizer, the JWT is fully
// verified by API Gateway before the Lambda is invoked. We only need to read
// the already-verified `sub` claim from the request context.
export function extractUserId(event: APIGatewayProxyEventV2): string {
  const ctx = event.requestContext as typeof event.requestContext & JwtAuthorizerContext;
  const sub = ctx.authorizer?.jwt?.claims?.sub;

  if (!sub || typeof sub !== "string") {
    throw new UnauthorizedError("Missing or invalid authorization claims");
  }

  return sub;
}
