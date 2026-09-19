import { DEFAULT_SELLER_SLUG } from '../sellers/sellers.constants';
import { isMarketplaceSplitEnabled } from './marketplace-mp.flags';

export type SellerMpPublicStatus = {
  connectEnabled: boolean;
  houseBrand: boolean;
  oauthStatus: 'pending' | 'linked' | 'expired' | 'revoked';
  linked: boolean;
  mpUserId: string | null;
};

export function isHouseBrandSeller(slug?: string | null): boolean {
  return String(slug || '').trim().toLowerCase() === DEFAULT_SELLER_SLUG;
}

export function sellerMpPublicStatus(seller: {
  slug: string;
  mpOAuthStatus?: string | null;
  mpUserId?: string | null;
}): SellerMpPublicStatus {
  const enabled = isMarketplaceSplitEnabled();
  const houseBrand = isHouseBrandSeller(seller.slug);
  const oauthStatus = (seller.mpOAuthStatus || 'pending') as SellerMpPublicStatus['oauthStatus'];
  return {
    connectEnabled: enabled && !houseBrand,
    houseBrand,
    oauthStatus,
    linked: enabled && oauthStatus === 'linked',
    mpUserId: enabled && seller.mpUserId ? String(seller.mpUserId) : null,
  };
}
