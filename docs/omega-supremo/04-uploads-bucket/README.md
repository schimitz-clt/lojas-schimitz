# 04 — Fotos (uploads) em bucket Railway

## PR 1 — suporte a bucket atrás de flag (desligado por padrão)
- `UPLOADS_STORAGE=s3` + `UPLOADS_S3_BUCKET/ENDPOINT/REGION/ACCESS_KEY_ID/SECRET_ACCESS_KEY` (+ `FORCE_PATH_STYLE`, `PREFIX`) liga.
  Variável faltando = comportamento antigo (só volume).
- Gravação: volume **sempre** + bucket (falha no bucket = falha no upload).
- Leitura: volume primeiro (static); se não existir no volume, serve do bucket na **mesma URL** `/api/v1/uploads/<arquivo>` (header `X-Uploads-Source: bucket`).
- Cópia: `uploads-copy-to-bucket.ts <dir>` copia (nunca move/apaga) e confere sha256 de cada arquivo.
- Testes: `uploads-s3.spec.ts` (CI) e `uploads-s3.int.spec.ts` (S3 local moto: volume e bucket com o mesmo sha256, 404 → null).
  Script de cópia testado contra moto: 2/2 copiados e verificados.
- Rollback: flag desligada (remover `UPLOADS_STORAGE`) ou reverter o merge. Volume intocado.

## PR 2 — cópia volume → bucket no próprio serviço
- Com `UPLOADS_S3_SYNC_FROM_VOLUME=true`, após subir, a API copia para o bucket os arquivos do volume que faltam/diferem,
  relê cada um e confere sha256. Nunca apaga. Log: `uploads_sync OK {files,copied,verified,mismatched,manifestSha256}`.
- Motivo: as credenciais ficam só nas variáveis da Railway (referências `${{uploads.*}}`); ninguém precisa vê-las.
