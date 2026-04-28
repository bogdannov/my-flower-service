import type { PairingCode } from "../../types";
import { BaseRepository } from "../db/base.repository";

export class PairingRepository extends BaseRepository<PairingCode> {
  async findByCode(code: string): Promise<PairingCode | null> {
    return this.get({ PK: code });
  }

  async create(pairingCode: PairingCode): Promise<{ success: boolean }> {
    return this.putWithCondition({ PK: pairingCode.code, ...pairingCode }, "attribute_not_exists(PK)");
  }

  async remove(code: string): Promise<void> {
    await this.delete({ PK: code });
  }
}
