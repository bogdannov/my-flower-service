import { UserFlowersService } from "../../../module/user-flowers/user-flowers.service";
import { BaseFactory } from "../base.factory";
import { LoggerFactory } from "./logger.factory";
import { UserFlowersRepositoryFactory } from "./user-flowers-repository.factory";

export class UserFlowersServiceFactory extends BaseFactory<UserFlowersService> {
  static injectionToken = "UserFlowersServiceFactory" as const;

  static inject = [UserFlowersRepositoryFactory.injectionToken, LoggerFactory.injectionToken] as const;

  constructor(
    private readonly repositoryFactory: UserFlowersRepositoryFactory,
    private readonly loggerFactory: LoggerFactory,
  ) {
    super();
  }

  protected async _make(): Promise<UserFlowersService> {
    const [repository, logger] = await Promise.all([this.repositoryFactory.make(), this.loggerFactory.make()]);
    return new UserFlowersService(repository, logger);
  }
}
