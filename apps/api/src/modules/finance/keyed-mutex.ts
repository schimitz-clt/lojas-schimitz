/**
 * In-process keyed mutex: serializes work for the same key (e.g. one payment) inside ONE replica.
 * Cross-replica safety still comes from the database (row locks, CAS updates, unique keys);
 * this only removes pointless contention when many webhooks for one payment arrive together.
 */
export class KeyedMutex {
  private readonly tails = new Map<string, Promise<unknown>>();

  async run<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.tails.get(key) || Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const tail = prev.then(() => gate);
    this.tails.set(key, tail);
    try {
      await prev.catch(() => undefined);
      return await fn();
    } finally {
      release();
      if (this.tails.get(key) === tail) this.tails.delete(key);
    }
  }

  size() {
    return this.tails.size;
  }
}
