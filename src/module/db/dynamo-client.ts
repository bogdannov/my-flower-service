import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { ConfigType } from "../config/Config";

export function createDynamoDBClient(config: ConfigType): DynamoDBDocumentClient {
  const client = new DynamoDBClient(
    config.DYNAMODB_ENDPOINT
      ? {
          endpoint: config.DYNAMODB_ENDPOINT,
          region: config.AWS_REGION,
          credentials: {
            accessKeyId: "test",
            secretAccessKey: "test",
          },
        }
      : { region: config.AWS_REGION },
  );

  return DynamoDBDocumentClient.from(client, {
    marshallOptions: {
      removeUndefinedValues: true,
      convertEmptyValues: false,
    },
  });
}
