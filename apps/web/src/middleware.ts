import { NextRequest, NextResponse } from 'next/server';
import { legacyAdminRedirect } from '@/lib/admin-sections';
import { wwwApexRedirectUrl } from '@/lib/www-redirect';

/**
 * www → apex 301 when Host reaches this Next.js app.
 * Infra still must route www (Railway custom domain or Cloudflare redirect).
 *
 * Admin Ciclo D: /admin?section=… (and /admin/ops, /admin/orders, …) → /admin/<seção>.
 * Hash deep-links (#admin-photo-queue) stay on the client — middleware never sees #.
 */
export function middleware(request: NextRequest) {
  const location = wwwApexRedirectUrl({
    host: request.headers.get('host') || request.headers.get('x-forwarded-host'),
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
  });
  if (location) {
    return NextResponse.redirect(location, 301);
  }

  const adminTo = legacyAdminRedirect({
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
  });
  if (adminTo) {
    return NextResponse.redirect(new URL(adminTo, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
