# Bundle / hidratação da loja

## PR #238 — polyfill `Buffer` fora do navegador

Causa: `lib/api.ts` (cliente) importa `lib/api-proxy.ts`; `buildProxyUpstreamInit` ali usava `Buffer.from`,
então o webpack embutia `next/dist/compiled/buffer` (22,6 KB parsed / 7,0 KB gzip, chunk `1991-*`) em **todas** as rotas.
Correção: função movida para `lib/api-proxy-upstream.ts`, importada só pelo route handler `app/api/v1/[[...path]]` (nodejs).

First Load JS (`next build`, base = main 5e0beab):

| rota | antes | depois |
|---|---|---|
| / | 152 kB | 145 kB |
| /produto/[slug] | 149 kB | 142 kB |
| /produtos | 136 kB | 129 kB |
| /departamento/[slug] | 136 kB | 129 kB |
| /carrinho | 127 kB | 120 kB |
| /checkout | 132 kB | 125 kB |
| /entrar | 126 kB | 119 kB |

Carga fria (hydrate.mjs: CPU 4×, 150 ms RTT ~1,6 Mbps, cache off, mediana de 5): JS transferido −11/−12 KB por rota;
ScriptDuration / TBT-like dentro do ruído (ex.: /produto 429→396 ms script; home 436→443).

Lighthouse mobile (simulate, mediana de 3, local A/B): TBT home 114→107 ms, PDP 41→37, /produtos 50→48 — ruído.
O ganho comprovado é de bytes; o de CPU é pequeno demais para separar do ruído.

## PR #239 — preços sem Intl na hidratação

Causa (perfil de CPU, carga fria a 4×): a 1ª formatação `pt-BR` da página (`brl()` → `toLocaleString`) carrega
os dados de locale do ICU — ~40–45 ms de main thread medidos no Chrome a 4× (`firstBRL`, intl.mjs) — e cada
`toLocaleString` ainda monta um formatter novo (~8 ms a cada 100 preços; home tem 138 chamadas, /produtos 219).
Correção: `lib/money-format.ts` monta "R$ 1.234,56" à mão, com a MESMA saída do Intl (arredondamento half-expand
sobre a forma decimal curta, NBSP, "-R$" inclusive -0). NaN/Infinity/exponencial caem no Intl.
Usado por brl (api.ts), formatBRL, splitBrl, wishlist, comparador, sugestões de busca, storefront-pro, pdp-share.
`pricing.ts` não foi tocado.

Equivalência: money-format.spec.ts (~2,4 milhões de comparações em Node) + mfchrome.mjs (457.160 valores × 4
formatos no ICU do Chrome 155): 0 diferenças. prices.mjs: todos os textos com R$ de home, /produtos e PDP
idênticos base × branch, sem erro de hidratação. intlprobe.mjs: chamadas Intl no load 138/219/102 → 0/0/0.

Carga fria (CPU 4×, 150 ms RTT, mediana de 7), base = main 59fd47b:

| rota | ScriptDuration | TBT-like |
|---|---|---|
| / | 425 → 366 ms | 368 → 308 |
| /produtos | 434 → 361 | 347 → 297 |
| /produto/[slug] | 405 → 346 | 265 → 251 |
| /carrinho (vazio) | 310 → 308 | 192 → 175 |

Lighthouse mobile TBT (mediana de 3): home 123 → 64 ms, PDP 42 → 30, /produtos 47 → 57 (ruído: runs com LCP 4,8–5,1 s).
Toque card→PDP (CPU 4×, mediana de 6): 395 → 346 ms. First Load JS: sem mudança (≈0 kB).
