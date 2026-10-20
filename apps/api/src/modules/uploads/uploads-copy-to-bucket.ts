/**
 * Copia (nunca move nem apaga) as fotos de um diretório para o bucket e confere sha256.
 * Uso: UPLOADS_STORAGE=s3 UPLOADS_S3_*=... tsx src/modules/uploads/uploads-copy-to-bucket.ts <dir> [--dry-run]
 * Sai com código 1 se algum arquivo não bater. Não imprime credenciais.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { UploadsS3Store, isSafeUploadName, mimeFromUploadName, uploadsS3Config } from './uploads-s3';

async function main() {
  const dir = process.argv[2];
  const dry = process.argv.includes('--dry-run');
  const cfg = uploadsS3Config();
  if (!dir || !cfg) throw new Error('uso: <dir> com UPLOADS_STORAGE=s3 e UPLOADS_S3_* definidos');
  const store = new UploadsS3Store(cfg);
  const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');
  const names = readdirSync(dir).filter((n) => isSafeUploadName(n) && statSync(join(dir, n)).isFile()).sort();
  let copied = 0, already = 0, ok = 0;
  const bad: string[] = [];
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
    if (remote && sha(remote.body) === h) ok++;
    else bad.push(n);
    console.log(`${n} ${h} ${remote && sha(remote.body) === h ? 'OK' : 'DIFERENTE'}`);
  }
  console.log(JSON.stringify({ files: names.length, alreadyInBucket: already, copied, verified: ok, mismatched: bad.length, dryRun: dry }));
  if (bad.length) process.exit(1);
}
main().catch((e) => {
  console.error(`falhou: ${e?.name || 'erro'} ${e?.message || ''}`);
  process.exit(1);
});
