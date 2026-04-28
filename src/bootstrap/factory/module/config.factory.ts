import { Config } from "../../../module/config";
import { BaseFactory } from "../base.factory";

export class ConfigFactory extends BaseFactory<Config> {
  static injectionToken = "ConfigFactory" as const;

  protected async _make() {
    return new Config();
  }
}
