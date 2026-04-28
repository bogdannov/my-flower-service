import { serializeError } from "serialize-error";
import type { Logger } from "winston";
import * as winston from "winston";
import { BaseFactory } from "../base.factory";
import { ConfigFactory } from "./config.factory";

export class LoggerFactory extends BaseFactory<Logger> {
  static injectionToken = "LoggerFactory" as const;

  static inject = [ConfigFactory.injectionToken] as const;

  constructor(protected configFactory: ConfigFactory) {
    super();
  }

  protected async _make() {
    const config = await this.configFactory.make();

    return winston.createLogger({
      format: winston.format.combine(
        winston.format.metadata(),
        winston.format((info) => {
          if (info.metadata !== undefined) {
            info.metadata = serializeError(info.metadata, { maxDepth: 10 });
          }
          return info;
        })(),
        winston.format.json(),
      ),
      transports: [new winston.transports.Console()],
      defaultMeta: { application: `autowatering-${config.get().STAGE}` },
      level: config.get().LOG_LEVEL,
    });
  }
}
