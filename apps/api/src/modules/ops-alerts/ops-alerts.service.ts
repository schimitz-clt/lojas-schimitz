import { Injectable, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { opsSignals } from '../../common/sliding-window';
import { structuredLog } from '../../common/structured-log';
import { MailService } from '../mail/mail.service';
import {
  evaluateOpsAlerts,
  formatOpsAlert,
  OpsAlertConfig,
  opsAlertConfigFromEnv,
} from './ops-alerts.rules';

/**
 * H4 — burst alerts by e-mail (free: reuses the Resend account already configured).
 * Disabled unless OPS_ALERT_EMAIL_TO is set. Always writes an `OPS_ALERT` log line when a rule fires.
 */
@Injectable()
export class OpsAlertsService implements OnModuleInit, OnModuleDestroy {
  private readonly config: OpsAlertConfig = opsAlertConfigFromEnv();
  private readonly lastSent = new Map<string, number>();
  private timer: NodeJS.Timeout | null = null;
  private pending: NodeJS.Timeout | null = null;
  private running = false;

  constructor(@Optional() private readonly mail?: MailService) {}

  onModuleInit() {
    // Payment signals are not tied to a request → periodic check (unref: never keeps the process alive).
    this.timer = setInterval(() => void this.runCheck(), 60_000);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    if (this.pending) clearTimeout(this.pending);
  }

  /** Called by the exception filter after a 5xx — debounced so a burst costs one evaluation. */
  checkSoon() {
    if (this.pending) return;
    this.pending = setTimeout(() => {
      this.pending = null;
      void this.runCheck();
    }, 2000);
    this.pending.unref?.();
  }

  status() {
    return { emailEnabled: this.config.enabled && Boolean(this.mail?.isConfigured()) };
  }

  /** Evaluate rules now; returns what fired (used by tests and the timer). Never throws. */
  async runCheck(now = Date.now()) {
    if (this.running) return [];
    this.running = true;
    try {
      const fired = evaluateOpsAlerts(
        this.config,
        (key, windowMs) => opsSignals.count(key, windowMs, now),
        this.lastSent,
        now,
      );
      const env = process.env.APP_ENV || process.env.NODE_ENV || 'development';
      const results: Array<{ key: string; count: number; emailed: number }> = [];
      for (const a of fired) {
        this.lastSent.set(a.rule.key, now);
        let emailed = 0;
        if (this.config.enabled && this.mail?.isConfigured()) {
          const { subject, text } = formatOpsAlert(a, env, this.config.cooldownMs, new Date(now));
          const bucket = new Date(now).toISOString().slice(0, 16);
          for (const to of this.config.recipients) {
            const r = await this.mail.notifyOpsAlert(to, subject, text, `${a.rule.key}:${bucket}`).catch(() => null);
            if (r?.sent) emailed++;
          }
        }
        structuredLog('warn', 'OPS_ALERT', {
          alert: a.rule.key,
          count: a.count,
          threshold: a.rule.threshold,
          windowMin: Math.round(a.rule.windowMs / 60_000),
          emailEnabled: this.config.enabled,
          emailed,
        });
        results.push({ key: a.rule.key, count: a.count, emailed });
      }
      return results;
    } catch {
      return [];
    } finally {
      this.running = false;
    }
  }
}
