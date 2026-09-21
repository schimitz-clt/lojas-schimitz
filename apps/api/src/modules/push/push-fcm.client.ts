import { Logger } from '@nestjs/common';
import {
  firebaseAdminConfiguredFromEnv,
  readFirebaseServiceAccountJson,
} from './push-fcm.config';
import { shouldDisableInvalidFcmToken } from './push-token.rules';

export type FcmSendItemResult = {
  token: string;
  success: boolean;
  messageId?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  disableToken: boolean;
};

export type FcmMulticastResult = {
  configured: boolean;
  reason: string;
  successCount: number;
  failureCount: number;
  results: FcmSendItemResult[];
};

export type FcmMessageInput = {
  title: string;
  body: string;
  imageUrl?: string | null;
  data: Record<string, string>;
  channelId?: string;
};

const CHANNEL = 'lojas_schimitz_promos';

type FcmMessaging = {
  sendEachForMulticast: (message: {
    tokens: string[];
    notification?: { title: string; body: string; imageUrl?: string };
    data?: Record<string, string>;
    android?: Record<string, unknown>;
  }) => Promise<{
    successCount: number;
    failureCount: number;
    responses: Array<{
      success: boolean;
      messageId?: string;
      error?: { code?: string; message?: string };
    }>;
  }>;
};

/**
 * Firebase Admin wrapper. Boot never throws if credentials are missing.
 * Send without credentials returns configured:false (NÃO EXECUTADO).
 */
export class PushFcmClient {
  private readonly log = new Logger(PushFcmClient.name);
  private initAttempted = false;
  private ready = false;
  private messaging: FcmMessaging | null = null;

  isConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
    return firebaseAdminConfiguredFromEnv(env).configured;
  }

  status(env: NodeJS.ProcessEnv = process.env) {
    const cfg = firebaseAdminConfiguredFromEnv(env);
    return {
      configured: cfg.configured,
      source: cfg.source,
      projectId: cfg.projectId,
      reason: cfg.reason,
    };
  }

  async ensureInit(env: NodeJS.ProcessEnv = process.env): Promise<boolean> {
    if (this.ready && this.messaging) return true;
    if (this.initAttempted && !this.ready) return false;
    this.initAttempted = true;
    const cfg = firebaseAdminConfiguredFromEnv(env);
    if (!cfg.configured) {
      this.log.warn('FCM NÃO EXECUTADO: Firebase Admin sem credenciais');
      return false;
    }
    try {
      const adminApp = await import('firebase-admin/app');
      const adminMsg = await import('firebase-admin/messaging');
      const json = readFirebaseServiceAccountJson(env);
      if (adminApp.getApps().length === 0) {
        if (json) {
          const sa = JSON.parse(json) as object;
          adminApp.initializeApp({
            credential: adminApp.cert(sa as Parameters<typeof adminApp.cert>[0]),
            projectId: cfg.projectId || undefined,
          });
        } else {
          adminApp.initializeApp();
        }
      }
      this.messaging = adminMsg.getMessaging() as unknown as FcmMessaging;
      this.ready = true;
      this.log.log(`FCM Admin pronto (source=${cfg.source || 'unknown'})`);
      return true;
    } catch (e) {
      this.ready = false;
      this.messaging = null;
      this.log.error(`FCM Admin init falhou: ${e instanceof Error ? e.message : String(e)}`);
      return false;
    }
  }

  async sendToTokens(tokens: string[], message: FcmMessageInput): Promise<FcmMulticastResult> {
    const unique = [...new Set(tokens.map((t) => String(t || '').trim()).filter(Boolean))];
    if (!unique.length) {
      return {
        configured: this.isConfigured(),
        reason: 'empty',
        successCount: 0,
        failureCount: 0,
        results: [],
      };
    }
    const ok = await this.ensureInit();
    if (!ok || !this.messaging) {
      return {
        configured: false,
        reason: 'not_configured',
        successCount: 0,
        failureCount: 0,
        results: unique.map((token) => ({
          token,
          success: false,
          errorCode: 'NÃO EXECUTADO',
          errorMessage: 'Firebase Admin não configurado',
          disableToken: false,
        })),
      };
    }

    const notification: { title: string; body: string; imageUrl?: string } = {
      title: message.title,
      body: message.body,
    };
    if (message.imageUrl) notification.imageUrl = message.imageUrl;

    try {
      const res = await this.messaging.sendEachForMulticast({
        tokens: unique,
        notification,
        data: message.data,
        android: {
          priority: 'high',
          notification: {
            channelId: message.channelId || CHANNEL,
            clickAction: 'OPEN_STOREFRONT',
            imageUrl: message.imageUrl || undefined,
          },
        },
      });
      const results: FcmSendItemResult[] = unique.map((token, i) => {
        const r = res.responses[i];
        const errorCode = r?.error?.code || null;
        const errorMessage = r?.error?.message ? String(r.error.message).slice(0, 300) : null;
        return {
          token,
          success: Boolean(r?.success),
          messageId: r?.messageId || null,
          errorCode,
          errorMessage,
          disableToken: shouldDisableInvalidFcmToken(errorCode),
        };
      });
      return {
        configured: true,
        reason: 'ok',
        successCount: res.successCount,
        failureCount: res.failureCount,
        results,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.log.error(`FCM sendEachForMulticast falhou: ${msg}`);
      return {
        configured: true,
        reason: 'send_error',
        successCount: 0,
        failureCount: unique.length,
        results: unique.map((token) => ({
          token,
          success: false,
          errorCode: 'send_error',
          errorMessage: msg.slice(0, 300),
          disableToken: false,
        })),
      };
    }
  }
}
