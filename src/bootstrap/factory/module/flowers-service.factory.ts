import { FlowersService } from "../../../module/flowers/flowers.service";
import { BaseFactory } from "../base.factory";
import { FlowersRepositoryFactory } from "./flowers-repository.factory";

export class FlowersServiceFactory extends BaseFactory<FlowersService> {
  static injectionToken = "FlowersServiceFactory" as const;

  static inject = [FlowersRepositoryFactory.injectionToken] as const;

  constructor(private readonly flowersRepositoryFactory: FlowersRepositoryFactory) {
    super();
  }

  protected async _make(): Promise<FlowersService> {
    const repo = await this.flowersRepositoryFactory.make();
    return new FlowersService(repo);
  }
}
