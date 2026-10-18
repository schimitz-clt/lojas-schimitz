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
