import { WateringRepository } from "../../../module/watering/watering.repository";
import { BaseFactory } from "../base.factory";
import { ConfigFactory } from "./config.factory";
import { DynamoDBClientFactory } from "./dynamodb-client.factory";

export class WateringRepositoryFactory extends BaseFactory<WateringRepository> {
  static injectionToken = "WateringRepositoryFactory" as const;

  static inject = [DynamoDBClientFactory.injectionToken, ConfigFactory.injectionToken] as const;

  constructor(
    private readonly dynamoDBClientFactory: DynamoDBClientFactory,
    private readonly configFactory: ConfigFactory,
  ) {
    super();
  }

  protected async _make(): Promise<WateringRepository> {
    const [client, config] = await Promise.all([this.dynamoDBClientFactory.make(), this.configFactory.make()]);
    return new WateringRepository(client, config.get().WATERING_EVENTS_TABLE);
  }
}
