import type { Device } from "../../types";
import { BaseRepository } from "../db/base.repository";

export class DevicesRepository extends BaseRepository<Device> {
  async findByDeviceId(deviceId: string): Promise<Device | null> {
    return this.get({ PK: deviceId });
  }

  async create(device: Device): Promise<void> {
    await this.put({
      PK: device.deviceId,
      ...device,
    });
  }

  async updateLastSeen(deviceId: string): Promise<void> {
    const now = new Date().toISOString();
    const { updateExpression, expressionValues, expressionNames } = this.buildUpdateExpression({ lastSeenAt: now });
    await this.updateItem({ PK: deviceId }, updateExpression, expressionValues, expressionNames);
  }

  async updateOnBoot(deviceId: string, firmwareVersion: string): Promise<void> {
    const now = new Date().toISOString();
    const { updateExpression, expressionValues, expressionNames } = this.buildUpdateExpression({
      status: "online",
      lastSeenAt: now,
      firmwareVersion,
    });
    await this.updateItem({ PK: deviceId }, updateExpression, expressionValues, expressionNames);
  }

  async linkToFlower(deviceId: string, userFlowerId: string, userId: string): Promise<void> {
    const now = new Date().toISOString();
    const { updateExpression, expressionValues, expressionNames } = this.buildUpdateExpression({
      userFlowerId,
      userId,
      pairedAt: now,
      status: "linked",
    });
    await this.updateItem({ PK: deviceId }, updateExpression, expressionValues, expressionNames);
  }

  async resetLinkage(deviceId: string): Promise<void> {
    const { updateExpression, expressionValues, expressionNames } = this.buildUpdateExpression({
      userFlowerId: null,
      userId: null,
      pairedAt: null,
      status: "online",
    });
    await this.updateItem({ PK: deviceId }, updateExpression, expressionValues, expressionNames);
  }

  async remove(deviceId: string): Promise<void> {
    await this.delete({ PK: deviceId });
  }
}
