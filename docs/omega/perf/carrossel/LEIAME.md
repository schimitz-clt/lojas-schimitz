# Carrossel da home: rolagem pesada (Android WebView) — PR 1 de perf

## Relato
Hector: com o app 1.0.14 instalado, arrastar o banner da home continua pesado. No navegador está mais leve.

## O que foi medido (e descartado)
- **Imagens não são o problema.** Banners de produção: original 1600×533 JPG (~52 KB); o celular recebe WebP 1200w (~16 KB). Decodificar 0,48 MP é barato.
- **A rolagem já é nativa** (overflow-x + scroll-snap, sem handler JS de arraste, sem onScroll, listeners de toque do React passivos).
- **Sem animações infinitas** na home (document.getAnimations() vazio em repouso).

## Causa (lado web) — trabalho no main thread a cada toque/troca de slide
1. Ao encostar o dedo, `pauseAuto()` fazia `setPaused(true)` → commit do React e re-render dos 9 slides (7 + 2 clones, cada um com Link + img) exatamente no início do gesto. Ao soltar, `setPaused(false)` 8 s depois → outro render.
2. Cada troca de slide (fim do swipe) re-renderizava os 9 slides de novo, só para mudar os pontos.
3. O ponto ativo animava `width` (8 → 22 px) por 150 ms: layout + paint do documento a cada frame logo após cada swipe.
4. O autoplay continuava trocando slide com o banner fora da tela (pessoa rolando a lista de produtos) → scroll programático + commit enquanto o dedo rola a página.

## Correção (sem mudar o visual — screenshot pixel-idêntico: banner-before.png × banner-after.png)
- Pausa por toque num `ref` (sem setState). Autoplay checa `pausedUntil`.
- Slides em componente `memo` com array estável por conjunto de banners: troca de slide só re-renderiza pontos/aria.
- Ponto ativo muda de largura sem transição de `width` (cor continua com transição).
- `IntersectionObserver`: autoplay só com ≥ 50% do banner visível.

## Antes × depois (build local de main × branch, mesmo proxy para a API de produção, Chrome mobile 412×915 DPR 2.625, CPU 4× mais lenta, 8 swipes por toque, 3 rodadas, mediana)
Ver `summary-swipe.txt`.

| Métrica (8 swipes) | Antes | Depois |
|---|---|---|
| Layout no main thread | 69,5 ms | 13 ms (−81%) |
| Recalc. de estilo | 24,9 ms | 5 ms (−80%) |
| Paint | 129 ms | 40 ms (−69%) |
| Script | 197 ms | 153 ms (−22%) |
| Tempo total de tarefas | 1689 ms | 1362 ms (−19%) |
| Long tasks | 0 | 0 |
| Frames perdidos (headless) | ~1–4 | ~3–5 (ruído; o headless não reproduz o travamento) |

Autoplay fora da tela (func-*.json): antes trocou 2 slides em 12 s com o banner fora da tela; depois 0.
Lighthouse mobile (lighthouse.txt): neutro (77/76 → 77/78, TBT 105–135 → 105–126, CLS 0,012 igual). Esperado: a mudança é na interação, não no carregamento.

## Causa provável no app (NÃO corrigível pelo site) — PR separado do Android
O WebView do app fica dentro de um `SwipeRefreshLayout` (puxar para atualizar). No topo da página (onde fica o banner), ele só olha o eixo Y: um swipe lateral com o dedo descendo um pouco (> ~8 dp) é "roubado" pelo puxar-para-atualizar, o WebView recebe CANCEL e o banner para no meio e volta. Isso só acontece no app, o que bate com "no navegador está mais leve". A correção (`HorizontalAwareSwipeRefreshLayout`) está num PR separado do Android e exige versão 1.0.15 na Play.

## NÃO COMPROVADO
- Sensação num celular Android real (não há aparelho nem emulador nesta máquina).
- Que o roubo do gesto pelo SwipeRefreshLayout é a causa principal no aparelho do Hector (dedução pelo código; não há como reproduzir sem aparelho).
