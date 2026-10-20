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

## Estado em 2026-10-20 ~16:05 UTC
- **Staging:** bucket `uploads` (iad, id 0e5c2ec2-a75d-4ea3-a49d-ed342d1ce9fe) criado. API com `UPLOADS_STORAGE=s3`
  e `UPLOADS_S3_*` como referências `${{uploads.*}}` (valores nunca lidos/impressos) e `UPLOADS_S3_SYNC_FROM_VOLUME=true`.
  Log: `uploadsBucket=on`; `uploads_sync OK files=0` — **o volume de staging está vazio**, então não há foto existente para provar a leitura do bucket.
- **Produção:** nada mudou além do código com a flag desligada (deploys 4357cb0e e o de 1221aa9). Volume intocado.
- **Volume:** anexado e intocado nos dois ambientes. Nenhum arquivo apagado ou movido.

## Falha de deploy medida (sonda GET /health a cada ~0,5 s, timeout 5 s; volume ainda montado)
| Deploy | Produção (API direto) | Produção (via site) | Staging |
|---|---|---|---|
| e6b60ab (~15:38) | 1×502 + 4×timeout em ~17 s | 1×502 + 4×timeout | 1×timeout |
| 1221aa9 (~15:58) | 1×502 + 2×timeout em ~6 s | 2×timeout | 1×timeout |
"Depois" (sem volume) **não medido**: o desmonte do volume não foi feito.

## Rollback
- Staging: remover `UPLOADS_STORAGE` (volta ao volume); o bucket pode ficar.
- Código: reverter #250 e #249. API produção anterior: deploy 852d1305-f94f-4a40-b9df-973932e7d7fc (e7f3f41).
- Reanexar volume (se um dia desmontado): Railway → lojas-schimitz → Volumes → `lojas-schimitz-uploads` em `/data/uploads`.
