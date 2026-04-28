import { DeleteItemCommand, DynamoDBClient, ScanCommand } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

export function getTestDynamoDBClient(): DynamoDBDocumentClient {
  const endpoint = process.env.DYNAMODB_ENDPOINT;
  if (!endpoint) {
    throw new Error("DYNAMODB_ENDPOINT is not set — are integration tests running?");
  }

  const client = new DynamoDBClient({
    endpoint,
    region: process.env.AWS_REGION ?? "eu-central-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "test",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "test",
    },
  });

  return DynamoDBDocumentClient.from(client, {
    marshallOptions: {
      removeUndefinedValues: true,
      convertEmptyValues: false,
    },
  });
}

export async function clearTable(tableName: string): Promise<void> {
  const endpoint = process.env.DYNAMODB_ENDPOINT;
  if (!endpoint) {
    throw new Error("DYNAMODB_ENDPOINT is not set");
  }

  const client = new DynamoDBClient({
    endpoint,
    region: process.env.AWS_REGION ?? "eu-central-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "test",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "test",
    },
  });

  const scanResult = await client.send(
    new ScanCommand({
      TableName: tableName,
      ConsistentRead: true,
    }),
  );

  const items = scanResult.Items ?? [];

  for (const item of items) {
    // Extract key attributes only
    const keyAttributes: Record<string, { S?: string; N?: string; B?: Uint8Array }> = {};

    // Get key schema from item — PK and SK are the standard keys, or just PK
    if (item.PK) keyAttributes.PK = item.PK;
    if (item.SK) keyAttributes.SK = item.SK;

    await client.send(
      new DeleteItemCommand({
        TableName: tableName,
        Key: keyAttributes,
      }),
    );
  }
}

export async function seedItem(tableName: string, item: Record<string, unknown>): Promise<void> {
  const docClient = getTestDynamoDBClient();

  await docClient.send(
    new PutCommand({
      TableName: tableName,
      Item: item,
    }),
  );
}
