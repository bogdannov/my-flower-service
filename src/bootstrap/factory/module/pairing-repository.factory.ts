import { PairingRepository } from "../../../module/device/pairing.repository";
import { BaseFactory } from "../base.factory";
import { ConfigFactory } from "./config.factory";
import { DynamoDBClientFactory } from "./dynamodb-client.factory";

export class PairingRepositoryFactory extends BaseFactory<PairingRepository> {
  static injectionToken = "PairingRepositoryFactory" as const;

  static inject = [DynamoDBClientFactory.injectionToken, ConfigFactory.injectionToken] as const;

  constructor(
    private readonly dynamoDBClientFactory: DynamoDBClientFactory,
    private readonly configFactory: ConfigFactory,
  ) {
    super();
  }

  protected async _make(): Promise<PairingRepository> {
    const [client, config] = await Promise.all([this.dynamoDBClientFactory.make(), this.configFactory.make()]);
    return new PairingRepository(client, config.get().PAIRING_CODES_TABLE);
  }
}
