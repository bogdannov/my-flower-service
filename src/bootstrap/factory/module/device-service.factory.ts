import { DeviceService } from "../../../module/device/device.service";
import { BaseFactory } from "../base.factory";
import { ConfigFactory } from "./config.factory";
import { DevicesRepositoryFactory } from "./devices-repository.factory";
import { LoggerFactory } from "./logger.factory";
import { SensorReadingsServiceFactory } from "./sensor-readings-service.factory";
import { UserFlowersServiceFactory } from "./user-flowers-service.factory";
import { WateringServiceFactory } from "./watering-service.factory";

export class DeviceServiceFactory extends BaseFactory<DeviceService> {
  static injectionToken = "DeviceServiceFactory" as const;

  static inject = [
    DevicesRepositoryFactory.injectionToken,
    UserFlowersServiceFactory.injectionToken,
    WateringServiceFactory.injectionToken,
    SensorReadingsServiceFactory.injectionToken,
    ConfigFactory.injectionToken,
    LoggerFactory.injectionToken,
  ] as const;

  constructor(
    private readonly devicesRepositoryFactory: DevicesRepositoryFactory,
    private readonly userFlowersServiceFactory: UserFlowersServiceFactory,
    private readonly wateringServiceFactory: WateringServiceFactory,
    private readonly sensorReadingsServiceFactory: SensorReadingsServiceFactory,
    private readonly configFactory: ConfigFactory,
    private readonly loggerFactory: LoggerFactory,
  ) {
    super();
  }

  protected async _make(): Promise<DeviceService> {
    const [devicesRepo, userFlowersService, wateringService, sensorReadingsService, config, logger] = await Promise.all(
      [
        this.devicesRepositoryFactory.make(),
        this.userFlowersServiceFactory.make(),
        this.wateringServiceFactory.make(),
        this.sensorReadingsServiceFactory.make(),
        this.configFactory.make(),
        this.loggerFactory.make(),
      ],
    );

    return new DeviceService(
      devicesRepo,
      userFlowersService,
      wateringService,
      sensorReadingsService,
      config.get(),
      logger,
    );
  }
}
