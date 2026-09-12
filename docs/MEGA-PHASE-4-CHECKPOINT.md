# MEGA Phase 4 (safe / additive) — checkpoint

**Data:** 2026-09-12 (America/Sao_Paulo)  
**Escopo:** pipeline de upload (validação + erros) + checklist de fotos placeholder no ops + gravar URL de upload no apex. Sem cobrança MP, sem migration destrutiva, sem Play publish, sem secrets, sem inventar foto de produto.

## Feito

| Item | Onde | Nota |
|------|------|------|
| Validação de upload | `upload-validate.ts` + `POST /admin/uploads` | JPG/PNG/WebP por magic-bytes; máx. 15 MB; MIME declarado é hint |
| Erros claros | `UPLOAD_EMPTY` / `TOO_LARGE` / `TYPE_INVALID` / `CONTENT_INVALID` | Multer `LIMIT_FILE_SIZE` → 400, não 500 |
| URL apex | `public-upload-base.ts` + `UploadsService.publicUrl` | Prefere `SITE_URL` → `APP_URL` → `NEXT_PUBLIC_SITE_URL` → `PUBLIC_WEB_URL`; www → apex; fallback `PUBLIC_API_URL` + rewrite Railway |
| Checklist dono | `GET /admin/ops` `catalog.placeholderProducts[{id,name}]` | Só id+nome; UI admin lista abaixo das badges |
| Dual-mode refresh | intacto | |
| Paleta | preto + `#FFD100` | sem Magalu blue |

## Curl — upload gated (sem JWT)

```
POST https://lojasschimitz.com.br/api/v1/admin/uploads
→ HTTP 401  code=UNAUTHORIZED
```

## Curl — imageUrl rewrite (já live)

```
GET https://lojasschimitz.com.br/api/v1/products
→ imageUrl apex para uploads Railway; placehold.co permanece até o dono trocar
```

## Fora deste slice

- Cobrança real Mercado Pago / Play production
- www Cloudflare/Railway ainda 404 (ver Phase 1–2)
- Substituir fotos placehold.co (ação do dono; ids no ops)
