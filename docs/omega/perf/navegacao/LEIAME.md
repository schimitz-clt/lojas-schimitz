# Navegação: card → produto e carrinho → checkout

## Medição de servidor (Railway, produção)
- Web `/produto/...` p95 = 40 ms; API p95 = 50 ms (últimas 2 h). **O servidor não é o gargalo.** O tempo vem da distância (Porto Alegre → Railway iad, ~150–200 ms por ida e volta) e de esperas em série no navegador.
- Rotas já trocam sem recarregar a página (`softNav: true` em `prod-before-nav.json`); dados do servidor já têm cache de 60 s (`revalidate: 60`).

## 1) Card → página do produto
Antes: o Link só pré-carregava o esqueleto (`loading.tsx`); os dados da PDP só eram pedidos no clique.
Agora: ao encostar o dedo no card (`pointerdown`), pedimos a rota COMPLETA (`router.prefetch(..., kind: 'full')`), uma vez por card. Só para os cards tocados — não baixa 24 PDPs por página.

Toque (dedo desce, 120 ms, sobe) → PDP pronta, CPU 4×, RTT 150 ms, 6 cards × 2 rodadas:
| | Antes | Depois |
|---|---|---|
| Mediana | 997 / 1027 ms | 350 / 348 ms |
| 1º toque | 1024 / 1039 ms | 672 / 664 ms |

## 2) Carrinho → checkout
Antes: o checkout esperava `/cart` + `/me/addresses` (1 ida e volta) para só então pedir o frete.
Agora: ao tocar em "Finalizar", o carrinho guarda o que já tem na tela (carrinho + endereços, vale 30 s, uso único). O checkout desenha na hora e pede o frete imediatamente; busca `/cart` de novo e só troca se mudou (sem 2ª cotação de frete). Endereços não são buscados de novo. O servidor continua recalculando tudo no pedido; pagamento intocado.

Toque em "Finalizar" → frete na tela, CPU 4×, API simulada com 150 ms (frete 550 ms), 5 × 2 rodadas:
| | Antes | Depois |
|---|---|---|
| Mediana | 976 / 988 ms | 821 / 829 ms (−1 ida e volta) |
| Chamadas à API | cart, addresses, loyalty, quote | cart, loyalty, quote |

## NÃO COMPROVADO
- Tempos em aparelho real e rede real (laboratório: Chrome headless com CPU/rede limitadas; carrinho→checkout com API simulada).
