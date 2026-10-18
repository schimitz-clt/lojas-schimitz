# Barras fixas/grudadas sem backdrop-filter (rolagem de listas e PDP) — PR de perf

`backdrop-filter: blur()` em barras sticky/fixed obriga o compositor a re-borrar o fundo a cada frame de rolagem — caro em GPU fraca (WebView Android).
Removido de: barra de filtros do catálogo/departamento (fundo 94% opaco), barra de compra fixa da PDP (88–94%), barra de checkout grudada do carrinho (96–98%), bandeja de comparar (94%).
Mantido: barra da campanha (fundo 72–82%, o blur aparece de verdade).

## Antes × depois (main 929c154 × branch, build local, CPU 4×, 412×915 DPR 2.625, 10 arrastes de toque, 3 rodadas)
| Página | Tempo de desenho do compositor (antes → depois) |
|---|---|
| /produtos | 1015 / 1022 / 1018 ms → 326 / 348 / 318 ms (−68%) |
| /produto/alarme-residencial-sem-fio | 1063 / 966 / 954 ms → 222 / 209 / 210 ms (−78%) |
| /carrinho (vazio, sem barra) | 24 → 23 ms (neutro) |
Long tasks 0, erros JS 0 nos dois. Visual: /produtos pixel-idêntico; PDP só muda dentro da barra de compra (o fundo atrás, 8–12% visível, não fica mais borrado).

NÃO COMPROVADO: sensação em aparelho real.
