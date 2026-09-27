# Velocidade no celular (Melhoria 3) — medições e causas

Ferramenta: Lighthouse 12.8.2, perfil **mobile** (Moto G Power emulado, 4G lento simulado, CPU 4×),
mediana de 3 execuções por página. Páginas: `/`, `/produtos`, `/produto/alarme-residencial-sem-fio`, `/checkout`.

## Antes — produção (27/09/2026 ~16:10 BRT)

| Página | Nota | LCP | CLS | TBT | Peso |
|---|---|---|---|---|---|
| Início | 86 | 2,96 s | 0,141 | 198 ms | 2.852 KB |
| Produtos | 83 | 3,18 s | 0,140 | 247 ms | 584 KB |
| Produto | 89 | 3,41 s | 0,000 | 163 ms | 586 KB |
| Checkout (deslogado) | 67 | 3,96 s | 0,455 | 65 ms | 629 KB |

## Causas encontradas
1. **Fotos enviadas pelo admin em tamanho original**. Os 3 banners da home são PNG 1920×1200 de 640–830 KB cada (2,2 MB dos 2,85 MB da página). O `<img>` tinha `sizes`, mas sem `srcSet` o celular baixava o arquivo de desktop.
2. **Cabeçalho só aparecia depois do JavaScript nas páginas estáticas** (`/produtos`, `/checkout`, `/entrar`, …). O `Header` usava `useSearchParams()` dentro de `<Suspense fallback={null}>`. Nessas páginas o HTML vinha sem o cabeçalho, e ele "empurrava" a página quando surgia (CLS 0,14).
3. **Checkout deslogado** faz um redirecionamento no navegador para `/entrar` (mais CLS e LCP). Não foi alterado: é o fluxo de login, sensível.
4. **LCP simulado é limitado por JavaScript/CPU**. Na medição real (sem simulação) o LCP acontece junto com o primeiro desenho (~0,2–0,4 s local). O Lighthouse soma ao LCP os ~280 KB de JS (React/Next ~110 KB + cromo da loja).

## Correções (PR "perf(web): mobile speed")
- `srcSet` WebP redimensionado via `/_next/image` (o otimizador do Next que já roda no serviço web) apenas para `/api/v1/uploads/*` dos nossos domínios. Mesmo elemento, mesmo CSS, mesmo layout. O `src` original fica como fallback. Para desligar: `NEXT_PUBLIC_DISABLE_IMAGE_OPTIMIZER=1` no build.
- O preload da foto LCP da home usa o mesmo `srcSet`/`sizes` da imagem (evita download duplo).
- `useSearchParams` isolado num componente filho que não desenha nada (`CatalogSearchSync`). O `Header` saiu do `Suspense` e agora vem no HTML de todas as páginas.

## Depois — build de produção local (mesmo código e dados reais via API de produção, só leitura)
Servidor `next start` local atrás de TLS local, com o Chrome resolvendo `lojasschimitz.com.br` → local.
Para comparar, o "antes local" foi medido no mesmo ambiente com o código da `main`.

| Página | Nota antes→depois | LCP | CLS antes→depois | Peso antes→depois |
|---|---|---|---|---|
| Início | 83 → 82 | 4,28 → 4,22 s | 0,001 → 0,001 | **2.925 → 719 KB** |
| Produtos | **76 → 87** | 4,23 → 4,04 s | **0,140 → 0** | 657 → 659 KB |
| Produto | 86 → 85 | 4,12 → 4,28 s | 0 → 0 | 655 → 657 KB |
| Checkout | **72 → 77** | 6,21 → 6,22 s | **0,140 → 0** | 707 → 709 KB |

Variação de ±3 pontos entre execuções é normal. O LCP local é maior que o de produção porque o servidor
local fica longe da API; o que vale é a comparação antes→depois no mesmo ambiente.

## Próximos passos possíveis (não feitos)
- Menos JS na primeira carga: o chat e o comparador podem ser carregados depois.
- Home: parte do conteúdo é buscada no navegador (`/products`, `/store/shelves`); dá para renderizar no servidor.
- Checkout deslogado: redirecionar para `/entrar` antes do JS. Precisa desenho cuidadoso por causa da sessão em memória.
- `next start` com `output: 'standalone'`: só um aviso no log, sem efeito na velocidade. Trocar o comando de start mexe no deploy.
