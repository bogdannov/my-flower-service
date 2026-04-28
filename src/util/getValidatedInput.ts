import type { APIGatewayProxyEventV2 } from "aws-lambda";
import type { ZodTypeAny, ZodObject } from "zod";

export type ZodInput = ZodObject<{
  query?: ZodTypeAny,
  body?: ZodTypeAny,
  params?: ZodTypeAny,
  headers?: ZodTypeAny,
}>;

export type ZodOutput<Z extends ZodInput> = Z["_output"]["query"] &
  Z["_output"]["body"] &
  Z["_output"]["params"] &
  Z["_output"]["headers"];

export function getValidatedInput<TInput extends ZodInput>(
  event: APIGatewayProxyEventV2,
  schema: TInput,
): ZodOutput<TInput> {
  const result = schema.safeParse({
    query: event.queryStringParameters,
    body: event.body,
    params: event.pathParameters,
    headers: event.headers,
  });

  if (!result.success) {
    throw result.error;
  }

  return {
    ...(result.data?.query ?? {}),
    ...(result.data?.body ?? {}),
    ...(result.data?.params ?? {}),
    ...(result.data?.headers ?? {}),
  };
}
