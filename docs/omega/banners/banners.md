# Banners da home — Lojas Schimitz (11 prontos para publicar)

Cores do site (azul-marinho, bordô, creme, dourado discreto), logo no topo, sem botão desenhado (o site já mostra "Conferir agora"), sem preço, produto, foto, app, "sem juros" ou promessas além de PIX 5%, frete grátis POA (CEP 90/91), até 12x no cartão (juros conforme o cartão), departamentos, marketplace e WhatsApp.

**Tamanho:** 2400×800 px (3:1 = proporção do container da home no desktop; no celular o site mostra 16:10 e corta as laterais, o texto fica no centro). JPG otimizado, 150–160 KB cada. Originais PNG (1x e 2x) para arquivo. `banners-resumo.png` = todos juntos; `banners-preview-mobile.png` = simulação do corte no celular.

## Ordem de publicação (comercial) e dados de cada banner

| Ordem | Título na imagem | Subtexto | Link | Texto alternativo (alt) | Arquivo | Peso |
|---|---|---|---|---|---|---|
| 1 | 5% OFF no PIX | Desconto de 5% pagando no PIX. | `/departamento/ofertas` | 5% off pagando no PIX | `banner-01-pix-5-off@2x.jpg` | 151 KB |
| 2 | Frete grátis em Porto Alegre | Para CEPs iniciados em 90 ou 91. | `/produtos` | Frete grátis em Porto Alegre | `banner-02-frete-gratis-poa@2x.jpg` | 158 KB |
| 3 | Parcele em até 12x no cartão | Juros conforme o cartão, informados no checkout. | `/produtos` | Parcele em até 12x no cartão, com juros conforme o cartão | `banner-03-parcele-12x@2x.jpg` | 158 KB |
| 4 | Marketplace Lojas Schimitz | Um carrinho, um pedido: frete e pagamento juntos. | `/marketplace` | Marketplace Lojas Schimitz: um carrinho, um pedido | `banner-04-marketplace@2x.jpg` | 161 KB |
| 5 | Ofertas Lojas Schimitz | Veja as ofertas e pague no PIX com 5% off. | `/departamento/ofertas` | Ofertas Lojas Schimitz, com 5% off no PIX | `banner-05-ofertas@2x.jpg` | 156 KB |
| 6 | Pague no PIX e economize 5% | O desconto aparece no checkout. | `/produtos` | Pague no PIX e economize 5% | `banner-06-pix-economize@2x.jpg` | 158 KB |
| 7 | Celulares e acessórios | Veja o que a loja tem disponível. | `/departamento/celulares` | Departamento de celulares e acessórios | `banner-07-celulares@2x.jpg` | 157 KB |
| 8 | Informática | Confira os produtos do departamento. | `/departamento/informatica` | Departamento de informática | `banner-08-informatica@2x.jpg` | 150 KB |
| 9 | Eletrodomésticos e casa | Para equipar a sua casa. | `/departamento/eletrodomesticos` | Eletrodomésticos e casa | `banner-09-eletro-casa@2x.jpg` | 152 KB |
| 10 | Casa e utilidades | Confira os produtos do departamento. | `/departamento/casa` | Departamento de casa e utilidades | `banner-10-casa-utilidades@2x.jpg` | 153 KB |
| 11 | Atendimento no WhatsApp | (51) 99625-3766 | `/suporte` | Atendimento pelo WhatsApp (51) 99625-3766 | `banner-11-whatsapp@2x.jpg` | 153 KB |

Campo *título* do banner no admin: deixar VAZIO (o site mostra o título como legenda e duplicaria o texto).

## Passo a passo no admin (Vitrine → Banners)  — depende do deploy do PR #201 (limite 11)

1. Entre no admin (sua conta) → Vitrine → Banners.
2. Desative (NÃO exclua) os 4 banners atuais: abra cada um, desmarque "ativo", salve. Reversível: é só reativar. Desativados não contam no limite.
3. Para cada linha da tabela, na ordem 1→11: "Criar banner", envie o JPG, cole o link, preencha o alt, deixe o título vazio, ordem = número da linha, ativo ligado, salve.
4. Abra a home no celular e no desktop: confira que a logo e o texto aparecem inteiros e que só há um botão "Conferir agora".
5. Para voltar atrás: desative os novos e reative os 4 antigos.

Risco: baixo (só dados de vitrine). Cada JPG é servido otimizado pelo site (~30 KB por slide no celular); só os 2 primeiros carregam de imediato, o resto é preguiçoso.
