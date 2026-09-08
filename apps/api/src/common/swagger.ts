import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/** Espelha isProdLikeEnv do payment.provider — sem acoplar main → payments. */
export function isProdLikeAppEnv() {
  const env = String(process.env.APP_ENV || process.env.NODE_ENV || '').toLowerCase();
  return env === 'production' || env === 'prod' || env === 'staging';
}

/**
 * OpenAPI/Swagger:
 * - default ON em development/test
 * - default OFF em production/staging
 * - SWAGGER_ENABLED=true|false sobrescreve
 * Nunca embute secrets no documento.
 */
export function shouldEnableSwagger(): boolean {
  const flag = String(process.env.SWAGGER_ENABLED || '').toLowerCase().trim();
  if (flag === 'false' || flag === '0' || flag === 'off') return false;
  if (flag === 'true' || flag === '1' || flag === 'on') return true;
  return !isProdLikeAppEnv();
}

export function setupSwagger(app: INestApplication, apiPrefix: string) {
  if (!shouldEnableSwagger()) {
    // eslint-disable-next-line no-console
    console.log(`Swagger disabled (env=${process.env.APP_ENV || process.env.NODE_ENV || 'development'})`);
    return null;
  }

  const config = new DocumentBuilder()
    .setTitle('Lojas Schimitz API')
    .setDescription(
      [
        'API REST `/api/v1` — envelope `{ ok, data, meta.requestId }`.',
        'Auth: `Authorization: Bearer <access_token>`.',
        'Carrinho visitante: header `x-guest-token`.',
        'Idempotência (pedidos/pagamentos): header `Idempotency-Key`.',
        '**Não** documenta nem expõe JWT secrets, SMTP, tokens MP ou webhooks secrets.',
      ].join('\n\n'),
    )
    .setVersion('0.6.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Access token JWT' },
      'access-token',
    )
    .addApiKey(
      { type: 'apiKey', in: 'header', name: 'x-guest-token', description: 'Token de carrinho visitante' },
      'guest-token',
    )
    .addApiKey(
      { type: 'apiKey', in: 'header', name: 'Idempotency-Key', description: 'Chave de idempotência' },
      'idempotency-key',
    )
    .addTag('health', 'Healthcheck')
    .addTag('auth', 'Registro, login, refresh (cookie HttpOnly + body), logout, reset de senha')
    .addTag('catalog', 'Categorias e produtos públicos')
    .addTag('cart', 'Carrinho user/guest')
    .addTag('shipping', 'Cotação de frete própria')
    .addTag('orders', 'Pedidos do cliente autenticado')
    .addTag('payments', 'Intents PIX/cartão + consulta')
    .addTag('addresses', 'Endereços do usuário (/me/addresses)')
    .addTag('admin', 'Painel administrativo (role=admin)')
    .addTag('webhooks', 'Webhooks de pagamento (Mercado Pago)')
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    deepScanRoutes: true,
  });

  // Sanidade: nunca listar env secrets no schema
  const raw = JSON.stringify(document);
  for (const leak of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'MERCADO_PAGO_ACCESS_TOKEN', 'SMTP_PASS', 'RESEND_API_KEY']) {
    if (raw.includes(leak)) {
      throw new Error(`Swagger document leaks env key name: ${leak}`);
    }
  }

  const path = `${apiPrefix.replace(/^\/|\/$/g, '')}/docs`;
  SwaggerModule.setup(path, app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
    },
    customSiteTitle: 'Lojas Schimitz API Docs',
  });

  // eslint-disable-next-line no-console
  console.log(`Swagger UI at /${path}`);
  return document;
}
