import { CollectionsService } from "../../../module/collections/collections.service";
import { BaseFactory } from "../base.factory";
import { CollectionsRepositoryFactory } from "./collections-repository.factory";
import { LoggerFactory } from "./logger.factory";
import { UserFlowersRepositoryFactory } from "./user-flowers-repository.factory";

export class CollectionsServiceFactory extends BaseFactory<CollectionsService> {
  static injectionToken = "CollectionsServiceFactory" as const;

  static inject = [
    CollectionsRepositoryFactory.injectionToken,
    UserFlowersRepositoryFactory.injectionToken,
    LoggerFactory.injectionToken,
  ] as const;

  constructor(
    private readonly collectionsRepositoryFactory: CollectionsRepositoryFactory,
    private readonly userFlowersRepositoryFactory: UserFlowersRepositoryFactory,
    private readonly loggerFactory: LoggerFactory,
  ) {
    super();
  }

  protected async _make(): Promise<CollectionsService> {
    const [collectionsRepo, userFlowersRepo, logger] = await Promise.all([
      this.collectionsRepositoryFactory.make(),
      this.userFlowersRepositoryFactory.make(),
      this.loggerFactory.make(),
    ]);
    return new CollectionsService(collectionsRepo, userFlowersRepo, logger);
  }
}
