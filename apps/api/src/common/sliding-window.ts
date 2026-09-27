/**
 * In-memory sliding-window event counter (per process). Used for burst detection
 * (HTTP 5xx, payment provider errors). Bounded: keeps at most `maxEvents` timestamps per key.
 */
export class SlidingWindowCounter {
  private readonly events = new Map<string, number[]>();

  constructor(
    private readonly retentionMs = 60 * 60_000,
    private readonly maxEvents = 5000,
  ) {}

  record(key: string, now = Date.now()) {
    const arr = this.events.get(key) || [];
    arr.push(now);
    if (arr.length > this.maxEvents) arr.splice(0, arr.length - this.maxEvents);
    this.events.set(key, arr);
    this.prune(key, now);
  }

  count(key: string, windowMs: number, now = Date.now()): number {
    const arr = this.events.get(key);
    if (!arr) return 0;
    this.prune(key, now);
    const since = now - windowMs;
    let n = 0;
    for (let i = arr.length - 1; i >= 0; i--) {
      if (arr[i] >= since) n++;
      else break;
    }
    return n;
  }

  reset() {
    this.events.clear();
  }

  private prune(key: string, now: number) {
    const arr = this.events.get(key);
    if (!arr) return;
    const cutoff = now - this.retentionMs;
    let drop = 0;
    while (drop < arr.length && arr[drop] < cutoff) drop++;
    if (drop) arr.splice(0, drop);
  }
}

/** Process-wide counters for ops signals. Keys: 'http_5xx', finance counter names. */
export const opsSignals = new SlidingWindowCounter();
