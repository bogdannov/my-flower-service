import { SensorReadingsService } from "../../../module/sensor-readings/sensor-readings.service";
import { BaseFactory } from "../base.factory";
import { ConfigFactory } from "./config.factory";
import { LoggerFactory } from "./logger.factory";
import { SensorReadingsRepositoryFactory } from "./sensor-readings-repository.factory";
import { UserFlowersServiceFactory } from "./user-flowers-service.factory";

export class SensorReadingsServiceFactory extends BaseFactory<SensorReadingsService> {
  static injectionToken = "SensorReadingsServiceFactory" as const;

  static inject = [
    SensorReadingsRepositoryFactory.injectionToken,
    UserFlowersServiceFactory.injectionToken,
    ConfigFactory.injectionToken,
    LoggerFactory.injectionToken,
  ] as const;

  constructor(
    private readonly repositoryFactory: SensorReadingsRepositoryFactory,
    private readonly userFlowersServiceFactory: UserFlowersServiceFactory,
    private readonly configFactory: ConfigFactory,
    private readonly loggerFactory: LoggerFactory,
  ) {
    super();
  }

  protected async _make(): Promise<SensorReadingsService> {
    const [repository, userFlowersService, config, logger] = await Promise.all([
      this.repositoryFactory.make(),
      this.userFlowersServiceFactory.make(),
      this.configFactory.make(),
      this.loggerFactory.make(),
    ]);
    return new SensorReadingsService(repository, userFlowersService, config.get(), logger);
  }
}
