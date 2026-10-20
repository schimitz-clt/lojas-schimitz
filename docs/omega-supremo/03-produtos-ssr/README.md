# /produtos no HTML do servidor — verificação 2026-10-20T15:15:51Z

**Já implementado no PR #211 (merge 2026-10-16, commit 65fd027). Nenhuma alteração de código nova — não repetido (regra 9).**

## curl (UA Googlebot, sem JS) em produção
- /produtos: 24 cards; 24 links únicos /produto/<slug>; BAILOUT_TO_CLIENT_SIDE_RENDERING: 0
- Primeiros nomes no HTML inicial:
  - Alarme residencial sem fio
  - Robô aspirador básico
  - Impressora jato de tinta Wi-Fi
  - GPS automotivo 5&quot;
  - Rádio portátil AM/FM
  - Leitor digital de e-books
  - Tablet 10&quot; 64GB Wi-Fi
  - Drone com câmera HD
- /produtos?page=2: 24 cards
- /departamento/ofertas: 24 cards
- /produtos?q=r%C3%A1dio: 1 cards

## Lighthouse 12 (mobile padrão, Chrome headless no box, produção)
Antes do #211 não há medição registrada; abaixo, estado atual (2 rodadas):
- run1 perf 93 a11y 95 seo 92 bp 93 LCP 2.9 s TBT 150 ms CLS 0
- run2 perf 93 a11y 95 seo 92 bp 93 LCP 3.1 s TBT 110 ms CLS 0

## Rollback
Se precisar: git revert 65fd027 (só front).
