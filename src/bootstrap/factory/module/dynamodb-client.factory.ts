import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { createDynamoDBClient } from "../../../module/db/dynamo-client";
import { BaseFactory } from "../base.factory";
import { ConfigFactory } from "./config.factory";

export class DynamoDBClientFactory extends BaseFactory<DynamoDBDocumentClient> {
  static injectionToken = "DynamoDBClientFactory" as const;

  static inject = [ConfigFactory.injectionToken] as const;

  constructor(private readonly configFactory: ConfigFactory) {
    super();
  }

  protected async _make(): Promise<DynamoDBDocumentClient> {
    const config = await this.configFactory.make();
    return createDynamoDBClient(config.get());
  }
}
