# OMEGA — auditoria e inventário (16/10/2026)

Classes: **A** comprovado em produção · **B** implementado, não comprovado · **C** parcial · **D** ausente · **E** bloqueado por terceiros/acesso · **F** não aplicável.
Regra: o que não foi provado é **NÃO COMPROVADO**. Sem segredos nem dados pessoais.

## Inventário
- Railway, projeto `daring-empathy`: ambientes `production` e `staging` recebem o `main` **juntos** (staging não é etapa prévia).
  Serviços: `lojas-schimitz` (API), `lojas-schimitz-web`, `Postgres`, `db-backup` (só produção, cron 06:15 UTC), bucket `db-backups`.
- Staging tem banco próprio (catálogo: 2 produtos vs 100 em produção, IDs disjuntos).
- Proteção do `main`: 4 checks obrigatórios (Web, API, Android, E2E). Nome do job e2e não pode mudar.
- Android: `versionName` 1.0.13 / `versionCode` 14, minSdk 24, targetSdk 36; permissões INTERNET, ACCESS_NETWORK_STATE, POST_NOTIFICATIONS; WebView em `lojasschimitz.com.br`.

## PRs desta rodada
| PR | Conteúdo | Estado |
|---|---|---|
| #210 | Jornada checkout/pedido + e2e 15 cenários | Mesclado `8f27fa3`; web+API SUCCESS em produção e staging |
| #211 | `/produtos` com produtos no HTML do servidor | Mesclado `65fd027`; produção: 0 → 24 links `/produto/` |
| #212 | Carrossel sem autoplay com movimento reduzido/aba oculta | Ver PR |
| #177 | CSP sem `unsafe-eval` | Draft; aguarda teste real de cartão (Hector) |

## Achados que dependem de decisão (não alterados)
1. Staging emite cookies com `Domain=.lojasschimitz.com.br`: no domínio `*.up.railway.app` o navegador descarta a sessão (login de navegador no staging não funciona). Ajuste de variável no staging.
2. POST com cookie de sessão e **sem** `Origin`/`Referer` é aceito (com `Origin` estranho → 403 `CSRF_ORIGIN`). Navegadores atuais mandam `Origin` em POST cross-site; risco baixo, mas endurecer exige cuidado com o app Android.
3. Access JWT continua válido até 15 min após logout (refresh é revogado → 401). Comportamento de JWT sem estado.
4. Catálogo de produção: 100/100 produtos sem foto, sem dimensões (largura/altura/comprimento), sem `features`/`boxContents`, sem avaliações. Frete por dimensões e conversão dependem disso.

## Checklist de dados reais (Hector)
- Fotos (mín. 1 por produto), dimensões e peso de embalagem, descrição com ficha técnica.
- Teste real: 1 PIX + 1 cartão → webhook → pago → e-mail → baixa de estoque → estorno (libera o #177).
- Play Console: subir o AAB 1.0.13 (versionCode 14), preencher Segurança dos dados (push/notificações), testar trilha interna.
