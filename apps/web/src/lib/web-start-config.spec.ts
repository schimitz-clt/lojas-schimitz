import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The web start command and next.config must agree.
 * `next start` + `output: 'standalone'` logs '"next start" does not work with "output: standalone"'
 * on every Railway deploy (seen in production 09/10/2026).
 */
const root = join(__dirname, '..', '..');
const nextConfig = readFileSync(join(root, 'next.config.ts'), 'utf8');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
const railway = readFileSync(join(root, 'railway.toml'), 'utf8');

const startsWithNextStart = /^next start\b/.test(pkg.scripts.start);
const railwayUsesNpmStart = /startCommand\s*=\s*"npm run start"/.test(railway);
const usesStandalone = /^\s*output:\s*['"]standalone['"]/m.test(nextConfig);

assert.ok(railwayUsesNpmStart, 'railway.toml deve iniciar com npm run start');
if (startsWithNextStart) {
  assert.equal(usesStandalone, false, 'next start não serve output standalone: remova output ou troque o start');
} else {
  assert.match(pkg.scripts.start, /node \.next\/standalone\/server\.js/);
  assert.equal(usesStandalone, true);
}

console.log('web-start-config.spec OK');
