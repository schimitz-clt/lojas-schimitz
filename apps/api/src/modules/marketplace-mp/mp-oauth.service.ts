import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { resolveSiteUrl } from '../auth/auth.service';
import { DEFAULT_SELLER_SLUG } from '../sellers/sellers.constants';
import { SellerPortalService } from '../sellers/seller-portal.service';
import { isHouseBrandSeller, sellerMpPublicStatus, type SellerMpPublicStatus } from './mp-oauth.public';
import {
  isMarketplaceSplitEnabled,
  marketplaceClientId,
  marketplaceClientSecret,
} from './marketplace-mp.flags';
import {
  buildAuthorizationUrl,
  exchangeAuthorizationCode,
  refreshSellerAccessToken,
  type FetchLike,
} from './mp-oauth.client';
import { signMpOAuthState, verifyMpOAuthState } from './mp-oauth-state';
import {
  decryptSecret,
  encryptSecret,
  resolveCredentialKey,
} from './seller-credential-crypto';

const HOUSE_BRAND_NO_SELF_SPLIT = 'HOUSE_BRAND_NO_SELF_SPLIT';
const HOUSE_BRAND_MESSAGE_PT =
  'A loja própria Lojas Schimitz permanece no collector da plataforma e não conecta conta de vendedor (sem self-split).';

export function marketplaceRedirectUri(env: NodeJS.ProcessEnv = process.env): string {
  const explicit = String(env.MP_MARKETPLACE_REDIRECT_URI || '').trim();
  if (explicit) return explicit.replace(/\/$/, '');
  return `${resolveSiteUrl(env).replace(/\/$/, '')}/vendedor/mp/callback`;
}

export { isHouseBrandSeller, sellerMpPublicStatus };
export type { SellerMpPublicStatus };

@Injectable()
export class MpOAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly portal: SellerPortalService,
  ) {}

  publicStatus(seller: {
    slug: string;
    mpOAuthStatus?: string | null;
    mpUserId?: string | null;
  }): SellerMpPublicStatus {
    return sellerMpPublicStatus(seller);
  }

  async statusForUser(userId: string): Promise<SellerMpPublicStatus> {
    const seller = await this.portal.requireOwnedSeller(userId);
    return sellerMpPublicStatus(seller);
  }

  async startConnect(userId: string, fetchImpl: FetchLike = fetch) {
    void fetchImpl;
    this.assertConnectEnabled();
    const seller = await this.portal.requireOwnedSeller(userId);
    if (isHouseBrandSeller(seller.slug)) {
      throw new BadRequestException({
        message: HOUSE_BRAND_MESSAGE_PT,
        code: HOUSE_BRAND_NO_SELF_SPLIT,
      });
    }
    const clientId = marketplaceClientId();
    if (!clientId) {
      throw new BadRequestException({
        message: 'App Mercado Pago Marketplace não configurado (MP_MARKETPLACE_CLIENT_ID).',
        code: 'MP_OAUTH_NOT_CONFIGURED',
      });
    }
    const redirectUri = marketplaceRedirectUri();
    const state = signMpOAuthState(seller.id);
    const authorizationUrl = buildAuthorizationUrl({
      clientId,
      redirectUri,
      state,
    });
    return { authorizationUrl, redirectUri };
  }

  async completeCallback(
    userId: string,
    input: { code: string; state: string },
    fetchImpl: FetchLike = fetch,
  ) {
    this.assertConnectEnabled();
    const seller = await this.portal.requireOwnedSeller(userId);
    if (isHouseBrandSeller(seller.slug)) {
      throw new BadRequestException({
        message: HOUSE_BRAND_MESSAGE_PT,
        code: HOUSE_BRAND_NO_SELF_SPLIT,
      });
    }
    const code = String(input.code || '').trim();
    const state = String(input.state || '').trim();
    if (!code || !state) {
      throw new BadRequestException({
        message: 'Código ou state OAuth ausente',
        code: 'MP_OAUTH_CALLBACK_INVALID',
      });
    }

    let payload: { sellerId: string };
    try {
      payload = verifyMpOAuthState(state);
    } catch (e: unknown) {
      const codeName = (e as { code?: string })?.code || 'MP_OAUTH_STATE_INVALID';
      throw new BadRequestException({
        message: e instanceof Error ? e.message : 'State OAuth inválido',
        code: codeName,
      });
    }
    if (payload.sellerId !== seller.id) {
      throw new ForbiddenException({
        message: 'State OAuth não pertence a este vendedor',
        code: 'MP_OAUTH_STATE_MISMATCH',
      });
    }

    const clientId = marketplaceClientId();
    const clientSecret = marketplaceClientSecret();
    if (!clientId || !clientSecret) {
      throw new BadRequestException({
        message: 'App Mercado Pago Marketplace não configurado (client_id / client_secret).',
        code: 'MP_OAUTH_NOT_CONFIGURED',
      });
    }

    let tokens;
    try {
      tokens = await exchangeAuthorizationCode(
        {
          clientId,
          clientSecret,
          code,
          redirectUri: marketplaceRedirectUri(),
        },
        fetchImpl,
      );
    } catch (e: unknown) {
      throw new BadRequestException({
        message: e instanceof Error ? e.message : 'Falha ao trocar o código OAuth',
        code: (e as { code?: string })?.code || 'MP_OAUTH_HTTP_ERROR',
      });
    }

    const key = resolveCredentialKey();
    const accessTokenEnc = encryptSecret(tokens.access_token, key);
    const refreshTokenEnc = encryptSecret(tokens.refresh_token, key);
    const expiresIn = tokens.expires_in && tokens.expires_in > 0 ? tokens.expires_in : 15552000;
    const mpUserId = String(tokens.user_id);

    const clash = await this.prisma.seller.findFirst({
      where: { mpUserId, NOT: { id: seller.id } },
      select: { id: true },
    });
    if (clash) {
      throw new BadRequestException({
        message: 'Esta conta Mercado Pago já está vinculada a outro vendedor.',
        code: 'MP_OAUTH_ACCOUNT_IN_USE',
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.seller.update({
        where: { id: seller.id },
        data: {
          mpUserId,
          mpPublicKey: tokens.public_key || null,
          mpOAuthStatus: 'linked',
          mpTokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
        },
      });
      await tx.sellerMpCredential.upsert({
        where: { sellerId: seller.id },
        update: { accessTokenEnc, refreshTokenEnc },
        create: { sellerId: seller.id, accessTokenEnc, refreshTokenEnc },
      });
    });

    return sellerMpPublicStatus({
      slug: seller.slug,
      mpOAuthStatus: 'linked',
      mpUserId,
    });
  }

  /**
   * Refresh tokens that expire within `aheadMs`. Scaffolding for Phase 1 —
   * stores the new refresh_token. Does not charge.
   */
  async refreshDue(opts?: {
    now?: Date;
    aheadMs?: number;
    fetchImpl?: FetchLike;
    limit?: number;
  }) {
    if (!isMarketplaceSplitEnabled()) {
      return { skipped: true as const, reason: 'flag_off', refreshed: 0, failed: 0 };
    }
    const clientId = marketplaceClientId();
    const clientSecret = marketplaceClientSecret();
    if (!clientId || !clientSecret) {
      return { skipped: true as const, reason: 'oauth_not_configured', refreshed: 0, failed: 0 };
    }

    const now = opts?.now ?? new Date();
    const aheadMs = opts?.aheadMs ?? 14 * 24 * 60 * 60 * 1000;
    const dueBefore = new Date(now.getTime() + aheadMs);
    const sellers = await this.prisma.seller.findMany({
      where: {
        mpOAuthStatus: 'linked',
        slug: { not: DEFAULT_SELLER_SLUG },
        OR: [{ mpTokenExpiresAt: null }, { mpTokenExpiresAt: { lte: dueBefore } }],
      },
      include: { mpCredential: true },
      take: opts?.limit ?? 50,
    });

    let refreshed = 0;
    let failed = 0;
    const fetchImpl = opts?.fetchImpl ?? fetch;
    let key: Buffer;
    try {
      key = resolveCredentialKey();
    } catch {
      return { skipped: true as const, reason: 'credential_key_missing', refreshed: 0, failed: 0 };
    }

    for (const seller of sellers) {
      if (!seller.mpCredential) {
        failed += 1;
        await this.prisma.seller
          .update({ where: { id: seller.id }, data: { mpOAuthStatus: 'expired' } })
          .catch(() => undefined);
        continue;
      }
      try {
        const refreshToken = decryptSecret(seller.mpCredential.refreshTokenEnc, key);
        const tokens = await refreshSellerAccessToken(
          { clientId, clientSecret, refreshToken },
          fetchImpl,
        );
        const accessTokenEnc = encryptSecret(tokens.access_token, key);
        const refreshTokenEnc = encryptSecret(tokens.refresh_token, key);
        const expiresIn = tokens.expires_in && tokens.expires_in > 0 ? tokens.expires_in : 15552000;
        await this.prisma.$transaction(async (tx) => {
          await tx.seller.update({
            where: { id: seller.id },
            data: {
              mpUserId: String(tokens.user_id),
              mpPublicKey: tokens.public_key || seller.mpPublicKey,
              mpOAuthStatus: 'linked',
              mpTokenExpiresAt: new Date(now.getTime() + expiresIn * 1000),
            },
          });
          await tx.sellerMpCredential.update({
            where: { sellerId: seller.id },
            data: { accessTokenEnc, refreshTokenEnc },
          });
        });
        refreshed += 1;
      } catch {
        failed += 1;
        await this.prisma.seller
          .update({ where: { id: seller.id }, data: { mpOAuthStatus: 'expired' } })
          .catch(() => undefined);
      }
    }

    return { skipped: false as const, refreshed, failed };
  }

  private assertConnectEnabled() {
    if (!isMarketplaceSplitEnabled()) {
      throw new NotFoundException({
        message: 'Conexão Mercado Pago indisponível',
        code: 'MP_CONNECT_DISABLED',
      });
    }
  }
}
