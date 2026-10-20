/**
 * Copia (nunca move nem apaga) as fotos de um diretório para o bucket e confere sha256.
 * Uso: UPLOADS_STORAGE=s3 UPLOADS_S3_*=... tsx src/modules/uploads/uploads-copy-to-bucket.ts <dir> [--dry-run]
 * Sai com código 1 se algum arquivo não bater. Não imprime credenciais.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { UploadsS3Store, isSafeUploadName, mimeFromUploadName, uploadsS3Config } from './uploads-s3';

export type SyncReport = {
  files: number;
  alreadyInBucket: number;
  copied: number;
  verified: number;
  mismatched: number;
  dryRun: boolean;
  /** sha256 de todos os arquivos verificados (curto, para conferir no log). */
  manifestSha256: string;
  mismatchedNames: string[];
};

/** Copia (nunca move/apaga) os arquivos de `dir` que faltam ou diferem no bucket e confere sha256. */
export async function syncDirToBucket(
  dir: string,
  store: UploadsS3Store,
  opts: { dryRun?: boolean; onFile?: (name: string, sha: string, ok: boolean) => void } = {},
): Promise<SyncReport> {
  const dry = Boolean(opts.dryRun);
  const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');
  const names = readdirSync(dir).filter((n) => isSafeUploadName(n) && statSync(join(dir, n)).isFile()).sort();
  let copied = 0, already = 0, ok = 0;
  const bad: string[] = [];
  const manifest = createHash('sha256');
  for (const n of names) {
    const local = readFileSync(join(dir, n));
    const h = sha(local);
    let remote = await store.get(n);
    if (remote && sha(remote.body) === h) already++;
    else if (!dry) {
      await store.put(n, local, mimeFromUploadName(n));
      copied++;
      remote = await store.get(n);
    }
    const good = Boolean(remote && sha(remote.body) === h);
    if (good) ok++;
    else bad.push(n);
    manifest.update(`${n} ${h}\n`);
    opts.onFile?.(n, h, good);
  }
  return {
    files: names.length,
    alreadyInBucket: already,
    copied,
    verified: ok,
    mismatched: bad.length,
    dryRun: dry,
    manifestSha256: manifest.digest('hex'),
    mismatchedNames: bad.slice(0, 20),
  };
}

async function main() {
  const dir = process.argv[2];
  const dry = process.argv.includes('--dry-run');
  const cfg = uploadsS3Config();
  if (!dir || !cfg) throw new Error('uso: <dir> com UPLOADS_STORAGE=s3 e UPLOADS_S3_* definidos');
  const r = await syncDirToBucket(dir, new UploadsS3Store(cfg), {
    dryRun: dry,
    onFile: (n, h, good) => console.log(`${n} ${h} ${good ? 'OK' : 'DIFERENTE'}`),
  });
  console.log(JSON.stringify(r));
  if (r.mismatched) process.exit(1);
}
if (require.main === module) {
  main().catch((e) => {
    console.error(`falhou: ${e?.name || 'erro'} ${e?.message || ''}`);
    process.exit(1);
  });
}
