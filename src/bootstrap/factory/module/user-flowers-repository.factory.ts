import { UserFlowersRepository } from "../../../module/user-flowers/user-flowers.repository";
import { BaseFactory } from "../base.factory";
import { ConfigFactory } from "./config.factory";
import { DynamoDBClientFactory } from "./dynamodb-client.factory";

export class UserFlowersRepositoryFactory extends BaseFactory<UserFlowersRepository> {
  static injectionToken = "UserFlowersRepositoryFactory" as const;

  static inject = [DynamoDBClientFactory.injectionToken, ConfigFactory.injectionToken] as const;

  constructor(
    private readonly dynamoDBClientFactory: DynamoDBClientFactory,
    private readonly configFactory: ConfigFactory,
  ) {
    super();
  }

  protected async _make(): Promise<UserFlowersRepository> {
    const [client, config] = await Promise.all([this.dynamoDBClientFactory.make(), this.configFactory.make()]);
    return new UserFlowersRepository(client, config.get().USER_FLOWERS_TABLE);
  }
}
