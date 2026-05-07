import { AiService } from "../../../module/ai/ai.service";
import { BaseFactory } from "../base.factory";
import { ConfigFactory } from "./config.factory";

export class AiServiceFactory extends BaseFactory<AiService> {
  static injectionToken = "AiServiceFactory" as const;

  static inject = [ConfigFactory.injectionToken] as const;

  constructor(private readonly configFactory: ConfigFactory) {
    super();
  }

  protected async _make(): Promise<AiService> {
    const config = await this.configFactory.make();
    return new AiService(config.get().ANTHROPIC_API_KEY);
  }
}
