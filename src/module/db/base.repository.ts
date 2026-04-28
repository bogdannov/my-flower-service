import type { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import {
  BatchGetCommand,
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

export interface QueryOptions {
  indexName?: string;
  scanIndexForward?: boolean;
  limit?: number;
  exclusiveStartKey?: Record<string, unknown>;
  filterExpression?: string;
  expressionAttributeValues?: Record<string, unknown>;
  expressionAttributeNames?: Record<string, string>;
}

export interface PaginatedResult<T> {
  items: T[];
  lastEvaluatedKey?: Record<string, unknown>;
}

export interface UpdateExpressionParts {
  updateExpression: string;
  expressionValues: Record<string, unknown>;
  expressionNames: Record<string, string>;
}

export abstract class BaseRepository<T> {
  constructor(
    protected readonly client: DynamoDBDocumentClient,
    protected readonly tableName: string,
  ) {}

  protected async get(key: Record<string, string>): Promise<T | null> {
    const result = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: key,
      }),
    );

    return (result.Item as T) ?? null;
  }

  protected async put(item: Record<string, unknown>): Promise<void> {
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: item,
      }),
    );
  }

  protected async putWithCondition(
    item: Record<string, unknown>,
    conditionExpression: string,
    expressionAttributeNames?: Record<string, string>,
  ): Promise<{ success: boolean }> {
    try {
      await this.client.send(
        new PutCommand({
          TableName: this.tableName,
          Item: item,
          ConditionExpression: conditionExpression,
          ExpressionAttributeNames: expressionAttributeNames,
        }),
      );
      return { success: true };
    } catch (error) {
      if ((error as ConditionalCheckFailedException).name === "ConditionalCheckFailedException") {
        return { success: false };
      }
      throw error;
    }
  }

  protected async query(
    keyCondition: string,
    expressionValues: Record<string, unknown>,
    options: QueryOptions = {},
  ): Promise<PaginatedResult<T>> {
    const mergedExpressionValues = {
      ...expressionValues,
      ...(options.expressionAttributeValues ?? {}),
    };

    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: options.indexName,
        KeyConditionExpression: keyCondition,
        ExpressionAttributeValues: mergedExpressionValues,
        ExpressionAttributeNames: options.expressionAttributeNames,
        FilterExpression: options.filterExpression,
        ScanIndexForward: options.scanIndexForward ?? true,
        Limit: options.limit,
        ExclusiveStartKey: options.exclusiveStartKey,
      }),
    );

    return {
      items: (result.Items as T[]) ?? [],
      lastEvaluatedKey: result.LastEvaluatedKey as Record<string, unknown> | undefined,
    };
  }

  protected async delete(key: Record<string, string>): Promise<void> {
    await this.client.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: key,
      }),
    );
  }

  protected async batchGet(keys: Record<string, string>[]): Promise<T[]> {
    if (keys.length === 0) return [];

    const chunks = this.chunkArray(keys, 100);
    const results: T[] = [];

    for (const chunk of chunks) {
      let unprocessed: Record<string, string>[] = chunk;
      let retries = 0;

      while (unprocessed.length > 0 && retries < 3) {
        const result = await this.client.send(
          new BatchGetCommand({
            RequestItems: {
              [this.tableName]: { Keys: unprocessed },
            },
          }),
        );

        const items = result.Responses?.[this.tableName] ?? [];
        results.push(...(items as T[]));

        const remaining = result.UnprocessedKeys?.[this.tableName]?.Keys;
        unprocessed = (remaining as Record<string, string>[] | undefined) ?? [];

        if (unprocessed.length > 0) {
          await new Promise((resolve) => setTimeout(resolve, 2 ** retries * 100));
          retries++;
        }
      }
    }

    return results;
  }

  // Renamed from `update` to avoid naming conflicts with domain-level update methods.
  protected async updateItem(
    key: Record<string, string>,
    updateExpression: string,
    expressionValues: Record<string, unknown>,
    expressionNames?: Record<string, string>,
  ): Promise<T> {
    const result = await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: key,
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: expressionValues,
        ExpressionAttributeNames: expressionNames,
        ReturnValues: "ALL_NEW",
      }),
    );

    return result.Attributes as T;
  }

  // Builds a SET update expression from a plain object of fields.
  // Uses index-based aliases (#f0, :v0) to avoid DynamoDB reserved word collisions.
  protected buildUpdateExpression(fields: Record<string, unknown>): UpdateExpressionParts {
    const expressionNames: Record<string, string> = {};
    const expressionValues: Record<string, unknown> = {};
    const parts: string[] = [];
    let i = 0;

    for (const [key, value] of Object.entries(fields)) {
      if (value === undefined) continue;
      const nameAlias = `#f${i}`;
      const valueAlias = `:v${i}`;
      expressionNames[nameAlias] = key;
      expressionValues[valueAlias] = value;
      parts.push(`${nameAlias} = ${valueAlias}`);
      i++;
    }

    return {
      updateExpression: `SET ${parts.join(", ")}`,
      expressionValues,
      expressionNames,
    };
  }

  private chunkArray<U>(array: U[], size: number): U[][] {
    const chunks: U[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
