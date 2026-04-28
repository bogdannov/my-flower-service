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

  async remove(deviceId: string): Promise<void> {
    await this.delete({ PK: deviceId });
  }
}
