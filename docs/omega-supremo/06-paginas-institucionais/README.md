# 06 — Sobre, Trocas e devoluções, Frete (+ Privacidade)

- Rotas novas: `/sobre`, `/trocas-e-devolucoes`, `/frete` (conteúdo em `apps/web/src/lib/institutional-pages.ts`), no rodapé (coluna Ajuda) e no sitemap.
- Base legal: CDC art. 49 (arrependimento 7 dias corridos, reembolso integral com frete), art. 26 (30/90 dias), art. 18 (30 dias para sanar);
  Decreto 7.962/2013 art. 2º (identificação do fornecedor). `/privacidade` (LGPD) já existia; agora mostra CNPJ/endereço como [PREENCHER] quando não configurados.
- Fatos usados (todos já públicos no site): Porto Alegre/RS, e-mail schimitzclaiton@gmail.com, WhatsApp (51) 99625-3766, PIX/cartão via Mercado Pago,
  frete por CEP com frete grátis em CEP 90/91 conforme regra vigente.
- **[PREENCHER] visível** (não inventado): nome/razão social, CNPJ ou CPF, endereço físico, endereço de devolução, transportadoras, histórico da loja.
  Para preencher sem código: variáveis `NEXT_PUBLIC_STORE_LEGAL_NAME`, `NEXT_PUBLIC_STORE_CNPJ`, `NEXT_PUBLIC_STORE_ADDRESS` no web (exige rebuild);
  endereço de devolução, transportadoras e histórico: editar `institutional-pages.ts`.
- `/termos`: o parágrafo de trocas exigia "estado do produto" para os 7 dias; ajustado ao art. 49 com link para a página nova.
- Rollback: reverter o merge (só front).
