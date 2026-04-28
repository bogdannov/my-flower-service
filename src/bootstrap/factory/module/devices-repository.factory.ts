import { DevicesRepository } from "../../../module/device/devices.repository";
import { BaseFactory } from "../base.factory";
import { ConfigFactory } from "./config.factory";
import { DynamoDBClientFactory } from "./dynamodb-client.factory";

export class DevicesRepositoryFactory extends BaseFactory<DevicesRepository> {
  static injectionToken = "DevicesRepositoryFactory" as const;

  static inject = [DynamoDBClientFactory.injectionToken, ConfigFactory.injectionToken] as const;

  constructor(
    private readonly dynamoDBClientFactory: DynamoDBClientFactory,
    private readonly configFactory: ConfigFactory,
  ) {
    super();
  }

  protected async _make(): Promise<DevicesRepository> {
    const [client, config] = await Promise.all([this.dynamoDBClientFactory.make(), this.configFactory.make()]);
    return new DevicesRepository(client, config.get().DEVICES_TABLE);
  }
}
