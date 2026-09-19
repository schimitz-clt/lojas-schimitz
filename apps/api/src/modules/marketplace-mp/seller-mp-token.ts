/**
 * Decrypt seller MP access tokens for Phase 2 sandbox fetch/refund/intent.
 * Never log plaintext. Returns null when key/row is missing.
 */

import { PrismaService } from '../../prisma.service';
import { decryptSecret, resolveCredentialKey } from './seller-credential-crypto';

export async function decryptSellerAccessToken(
  prisma: PrismaService,
  sellerId: string,
): Promise<string | null> {
  const row = await prisma.sellerMpCredential.findUnique({
    where: { sellerId },
    select: { accessTokenEnc: true },
  });
  if (!row?.accessTokenEnc) return null;
  let key: Buffer;
  try {
    key = resolveCredentialKey();
  } catch {
    return null;
  }
  try {
    return decryptSecret(row.accessTokenEnc, key);
  } catch {
    return null;
  }
}

export async function decryptSellerAccessTokenByMpUserId(
  prisma: PrismaService,
  mpUserId: string,
): Promise<string | null> {
  const seller = await prisma.seller.findUnique({
    where: { mpUserId },
    select: { id: true },
  });
  if (!seller) return null;
  return decryptSellerAccessToken(prisma, seller.id);
}

export async function listLinkedSellerAccessTokens(
  prisma: PrismaService,
  limit = 20,
): Promise<Array<{ sellerId: string; mpUserId: string; accessToken: string }>> {
  const sellers = await prisma.seller.findMany({
    where: { mpOAuthStatus: 'linked', mpUserId: { not: null } },
    include: { mpCredential: true },
    take: Math.min(Math.max(limit, 1), 50),
  });
  let key: Buffer;
  try {
    key = resolveCredentialKey();
  } catch {
    return [];
  }
  const out: Array<{ sellerId: string; mpUserId: string; accessToken: string }> = [];
  for (const seller of sellers) {
    if (!seller.mpCredential || !seller.mpUserId) continue;
    try {
      out.push({
        sellerId: seller.id,
        mpUserId: seller.mpUserId,
        accessToken: decryptSecret(seller.mpCredential.accessTokenEnc, key),
      });
    } catch {
      /* skip undecryptable row */
    }
  }
  return out;
}
