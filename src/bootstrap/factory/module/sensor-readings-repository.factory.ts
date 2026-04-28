import { SensorReadingsRepository } from "../../../module/sensor-readings/sensor-readings.repository";
import { BaseFactory } from "../base.factory";
import { ConfigFactory } from "./config.factory";
import { DynamoDBClientFactory } from "./dynamodb-client.factory";

export class SensorReadingsRepositoryFactory extends BaseFactory<SensorReadingsRepository> {
  static injectionToken = "SensorReadingsRepositoryFactory" as const;

  static inject = [DynamoDBClientFactory.injectionToken, ConfigFactory.injectionToken] as const;

  constructor(
    private readonly dynamoDBClientFactory: DynamoDBClientFactory,
    private readonly configFactory: ConfigFactory,
  ) {
    super();
  }

  protected async _make(): Promise<SensorReadingsRepository> {
    const [client, config] = await Promise.all([this.dynamoDBClientFactory.make(), this.configFactory.make()]);
    return new SensorReadingsRepository(client, config.get().SENSOR_READINGS_TABLE);
  }
}
