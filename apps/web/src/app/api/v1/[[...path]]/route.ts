import { NextRequest, NextResponse } from 'next/server';
import {
  buildUpstreamUrl,
  rewriteSetCookieHeaders,
} from '@/lib/api-proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
]);

type RouteCtx = { params: Promise<{ path?: string[] }> };

async function proxyRequest(req: NextRequest, pathParts: string[] | undefined) {
  const upstreamUrl = buildUpstreamUrl(pathParts, req.nextUrl.search);

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (HOP_BY_HOP.has(key.toLowerCase())) return;
    headers.set(key, value);
  });
  headers.delete('host');

  const init: RequestInit = {
    method: req.method,
    headers,
    redirect: 'manual',
    cache: 'no-store',
  };

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const buf = await req.arrayBuffer();
    if (buf.byteLength > 0) {
      init.body = Buffer.from(buf);
    }
  }

  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(upstreamUrl, init);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'proxy upstream error';
    return NextResponse.json(
      { ok: false, error: { code: 'BAD_GATEWAY', message: `API proxy: ${message}` } },
      { status: 502 },
    );
  }

  const outHeaders = new Headers();
  upstreamRes.headers.forEach((value, key) => {
    const lk = key.toLowerCase();
    if (lk === 'transfer-encoding' || lk === 'connection' || lk === 'content-encoding') return;
    if (lk === 'set-cookie') return;
    outHeaders.set(key, value);
  });

  const rawCookies =
    typeof upstreamRes.headers.getSetCookie === 'function'
      ? upstreamRes.headers.getSetCookie()
      : [];
  for (const c of rewriteSetCookieHeaders(rawCookies)) {
    outHeaders.append('set-cookie', c);
  }

  return new NextResponse(upstreamRes.body, {
    status: upstreamRes.status,
    statusText: upstreamRes.statusText,
    headers: outHeaders,
  });
}

async function handle(req: NextRequest, ctx: RouteCtx) {
  const { path } = await ctx.params;
  return proxyRequest(req, path);
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const HEAD = handle;
export const OPTIONS = handle;
