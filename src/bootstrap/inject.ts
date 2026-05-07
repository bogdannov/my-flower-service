import { createInjector } from "typed-inject";
import { AiServiceFactory } from "./factory/module/ai-service.factory";
import { CollectionsRepositoryFactory } from "./factory/module/collections-repository.factory";
import { CollectionsServiceFactory } from "./factory/module/collections-service.factory";
import { ConfigFactory } from "./factory/module/config.factory";
import { DeviceServiceFactory } from "./factory/module/device-service.factory";
import { DevicesRepositoryFactory } from "./factory/module/devices-repository.factory";
import { DynamoDBClientFactory } from "./factory/module/dynamodb-client.factory";
import { FlowersRepositoryFactory } from "./factory/module/flowers-repository.factory";
import { FlowersServiceFactory } from "./factory/module/flowers-service.factory";
import { LoggerFactory } from "./factory/module/logger.factory";
import { SensorReadingsRepositoryFactory } from "./factory/module/sensor-readings-repository.factory";
import { SensorReadingsServiceFactory } from "./factory/module/sensor-readings-service.factory";
import { UserFlowersRepositoryFactory } from "./factory/module/user-flowers-repository.factory";
import { UserFlowersServiceFactory } from "./factory/module/user-flowers-service.factory";
import { WateringRepositoryFactory } from "./factory/module/watering-repository.factory";
import { WateringServiceFactory } from "./factory/module/watering-service.factory";

const injector = createInjector()
  .provideClass(ConfigFactory.injectionToken, ConfigFactory)
  .provideClass(LoggerFactory.injectionToken, LoggerFactory)
  .provideClass(DynamoDBClientFactory.injectionToken, DynamoDBClientFactory)
  .provideClass(UserFlowersRepositoryFactory.injectionToken, UserFlowersRepositoryFactory)
  .provideClass(UserFlowersServiceFactory.injectionToken, UserFlowersServiceFactory)
  .provideClass(CollectionsRepositoryFactory.injectionToken, CollectionsRepositoryFactory)
  .provideClass(CollectionsServiceFactory.injectionToken, CollectionsServiceFactory)
  .provideClass(WateringRepositoryFactory.injectionToken, WateringRepositoryFactory)
  .provideClass(WateringServiceFactory.injectionToken, WateringServiceFactory)
  .provideClass(SensorReadingsRepositoryFactory.injectionToken, SensorReadingsRepositoryFactory)
  .provideClass(SensorReadingsServiceFactory.injectionToken, SensorReadingsServiceFactory)
  .provideClass(DevicesRepositoryFactory.injectionToken, DevicesRepositoryFactory)
  .provideClass(DeviceServiceFactory.injectionToken, DeviceServiceFactory)
  .provideClass(FlowersRepositoryFactory.injectionToken, FlowersRepositoryFactory)
  .provideClass(FlowersServiceFactory.injectionToken, FlowersServiceFactory)
  .provideClass(AiServiceFactory.injectionToken, AiServiceFactory);

export function inject() {
  return {
    Config: () => injector.resolve(ConfigFactory.injectionToken).make(),
    Logger: () => injector.resolve(LoggerFactory.injectionToken).make(),
    DynamoDBClient: () => injector.resolve(DynamoDBClientFactory.injectionToken).make(),
    UserFlowersRepository: () => injector.resolve(UserFlowersRepositoryFactory.injectionToken).make(),
    UserFlowersService: () => injector.resolve(UserFlowersServiceFactory.injectionToken).make(),
    CollectionsRepository: () => injector.resolve(CollectionsRepositoryFactory.injectionToken).make(),
    CollectionsService: () => injector.resolve(CollectionsServiceFactory.injectionToken).make(),
    WateringRepository: () => injector.resolve(WateringRepositoryFactory.injectionToken).make(),
    WateringService: () => injector.resolve(WateringServiceFactory.injectionToken).make(),
    SensorReadingsRepository: () => injector.resolve(SensorReadingsRepositoryFactory.injectionToken).make(),
    SensorReadingsService: () => injector.resolve(SensorReadingsServiceFactory.injectionToken).make(),
    DevicesRepository: () => injector.resolve(DevicesRepositoryFactory.injectionToken).make(),
    DeviceService: () => injector.resolve(DeviceServiceFactory.injectionToken).make(),
    FlowersRepository: () => injector.resolve(FlowersRepositoryFactory.injectionToken).make(),
    FlowersService: () => injector.resolve(FlowersServiceFactory.injectionToken).make(),
    AiService: () => injector.resolve(AiServiceFactory.injectionToken).make(),
  };
}

export function resetContainer(): void {
  injector.resolve(ConfigFactory.injectionToken).reset();
  injector.resolve(LoggerFactory.injectionToken).reset();
  injector.resolve(DynamoDBClientFactory.injectionToken).reset();
  injector.resolve(UserFlowersRepositoryFactory.injectionToken).reset();
  injector.resolve(UserFlowersServiceFactory.injectionToken).reset();
  injector.resolve(CollectionsRepositoryFactory.injectionToken).reset();
  injector.resolve(CollectionsServiceFactory.injectionToken).reset();
  injector.resolve(WateringRepositoryFactory.injectionToken).reset();
  injector.resolve(WateringServiceFactory.injectionToken).reset();
  injector.resolve(SensorReadingsRepositoryFactory.injectionToken).reset();
  injector.resolve(SensorReadingsServiceFactory.injectionToken).reset();
  injector.resolve(DevicesRepositoryFactory.injectionToken).reset();
  injector.resolve(DeviceServiceFactory.injectionToken).reset();
  injector.resolve(FlowersRepositoryFactory.injectionToken).reset();
  injector.resolve(FlowersServiceFactory.injectionToken).reset();
  injector.resolve(AiServiceFactory.injectionToken).reset();
}
