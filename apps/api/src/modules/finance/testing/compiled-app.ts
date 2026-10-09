/**
 * TEST ONLY — compiles apps/api/src with the real `tsc` (same as `npm run build`, so decorator
 * metadata exists and the global ValidationPipe validates DTOs exactly like production) into
 * apps/api/.e2e-dist (git-ignored), then boots the HTTP app with the same setup as src/main.ts.
 */
import { spawnSync } from 'child_process';
import { existsSync, rmSync } from 'fs';
import { join, resolve } from 'path';

export const API_ROOT = resolve(__dirname, '../../../..');
export const E2E_DIST = join(API_ROOT, '.e2e-dist');

export function compileApi(): void {
  rmSync(E2E_DIST, { recursive: true, force: true });
  const r = spawnSync('npx', ['tsc', '-p', 'tsconfig.json', '--outDir', E2E_DIST, '--sourceMap', 'false'], { cwd: API_ROOT, stdio: 'inherit' });
  if (r.status !== 0 || !existsSync(join(E2E_DIST, 'app.module.js'))) throw new Error('tsc compile for e2e failed');
}

/** Boots the compiled AppModule over real HTTP on 127.0.0.1:<random>. Mirrors src/main.ts. */
export async function bootHttpApp(port = 0): Promise<{ app: any; base: string; get: <T = any>(token: string, file: string) => T; close: () => Promise<void> }> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { NestFactory } = require('@nestjs/core');
  const { ValidationPipe } = require('@nestjs/common');
  const { AppModule } = require(join(E2E_DIST, 'app.module.js'));
  const { applyHttpBodyParsers } = require(join(E2E_DIST, 'common/http-body-parsers.js'));
  const app = await NestFactory.create(AppModule, { bodyParser: false, logger: ['error'] });
  applyHttpBodyParsers(app);
  const prefix = 'api/v1';
  app.setGlobalPrefix(prefix);
  app.enableCors({ origin: ['http://localhost:3000'], credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.set('trust proxy', 1);
  await app.listen(port, '127.0.0.1');
  const url: string = await app.getUrl();
  return {
    app,
    base: `${url.replace('[::1]', '127.0.0.1')}/${prefix}`,
    get: (token: string, file: string) => app.get(require(join(E2E_DIST, file))[token]),
    close: () => app.close(),
  };
}
