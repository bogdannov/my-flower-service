import { WateringService } from "../../../module/watering/watering.service";
import { BaseFactory } from "../base.factory";
import { LoggerFactory } from "./logger.factory";
import { UserFlowersServiceFactory } from "./user-flowers-service.factory";
import { WateringRepositoryFactory } from "./watering-repository.factory";

export class WateringServiceFactory extends BaseFactory<WateringService> {
  static injectionToken = "WateringServiceFactory" as const;

  static inject = [
    WateringRepositoryFactory.injectionToken,
    UserFlowersServiceFactory.injectionToken,
    LoggerFactory.injectionToken,
  ] as const;

  constructor(
    private readonly repositoryFactory: WateringRepositoryFactory,
    private readonly userFlowersServiceFactory: UserFlowersServiceFactory,
    private readonly loggerFactory: LoggerFactory,
  ) {
    super();
  }

  protected async _make(): Promise<WateringService> {
    const [repository, userFlowersService, logger] = await Promise.all([
      this.repositoryFactory.make(),
      this.userFlowersServiceFactory.make(),
      this.loggerFactory.make(),
    ]);
    return new WateringService(repository, userFlowersService, logger);
  }
}
