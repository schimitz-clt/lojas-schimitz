import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

type AttemptBucket = {
  /** Timestamps (ms) of failed attempts still inside the window */
  fails: number[];
};

/**
 * In-memory brute-force protection for auth endpoints (v1).
 * Window + counter only — no permanent lockout. Cleared on successful login.
 * Per-process (fine for single API instance; Redis later if we scale out).
 */
@Injectable()
export class LoginAttemptService {
  static readonly MAX_FAILS = 5;
  static readonly WINDOW_MS = 15 * 60 * 1000;

  private readonly byKey = new Map<string, AttemptBucket>();

  assertAllowed(ip: string, email?: string) {
    const keys = this.keys(ip, email);
    for (const key of keys) {
      const count = this.pruneAndCount(key);
      if (count >= LoginAttemptService.MAX_FAILS) {
        throw new HttpException(
          {
            message:
              'Muitas tentativas de login. Aguarde 15 minutos e tente novamente.',
            code: 'RATE_LIMITED',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }
  }

  recordFailure(ip: string, email?: string) {
    const now = Date.now();
    for (const key of this.keys(ip, email)) {
      const bucket = this.byKey.get(key) ?? { fails: [] };
      bucket.fails.push(now);
      this.byKey.set(key, bucket);
      this.pruneAndCount(key);
    }
  }

  clear(ip: string, email?: string) {
    for (const key of this.keys(ip, email)) {
      this.byKey.delete(key);
    }
  }

  /** Test/helpers */
  count(ip: string, email?: string): number {
    const keys = this.keys(ip, email);
    return Math.max(0, ...keys.map((k) => this.pruneAndCount(k)));
  }

  private keys(ip: string, email?: string): string[] {
    const safeIp = (ip || 'unknown').trim() || 'unknown';
    const out = [`ip:${safeIp}`];
    if (email) {
      const normalized = email.trim().toLowerCase();
      if (normalized) out.push(`email:${normalized}`);
    }
    return out;
  }

  private pruneAndCount(key: string): number {
    const bucket = this.byKey.get(key);
    if (!bucket) return 0;
    const cutoff = Date.now() - LoginAttemptService.WINDOW_MS;
    bucket.fails = bucket.fails.filter((t) => t > cutoff);
    if (bucket.fails.length === 0) {
      this.byKey.delete(key);
      return 0;
    }
    this.byKey.set(key, bucket);
    return bucket.fails.length;
  }
}
