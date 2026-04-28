export abstract class BaseFactory<T> {
  protected result: T | null = null;

  protected abstract _make(): Promise<T>;

  async make(): Promise<T> {
    if (this.result === null) {
      this.result = await this._make();
    }

    return this.result;
  }

  reset() {
    this.result = null;
  }
}
