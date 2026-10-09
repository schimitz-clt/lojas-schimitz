# "Até 3x sem juros": o que o código configura e o que o Mercado Pago responde

Consulta de **só leitura** em 09/10/2026, sem criar cobrança nem pedido.

## O que o código faz
- Vitrine/PDP/rodapé/header: texto "até 3x sem juros" vem de **uma constante** (`INTEREST_FREE_INSTALLMENTS = 3`, `apps/web/src/lib/pricing.ts`). O comentário do código diz que isso supõe o "Parcelado vendedor" ativo na conta do Mercado Pago.
- Formulário de cartão (Card Payment Brick): `minInstallments 1`, `maxInstallments 12`. As parcelas oferecidas **vêm do Mercado Pago**, conforme a conta e o cartão.
- API (`payment.provider.ts`): envia `installments` escolhido no formulário e `payment_method_id`. **Não** envia `max_installments`, taxa nem "sem juros": quem decide a taxa é a configuração da conta no Mercado Pago.

## O que o Mercado Pago responde (chave pública que o site já entrega ao navegador)
Consulta `GET https://api.mercadopago.com/v1/payment_methods/installments?public_key=…&amount=…&bin=…` com BINs públicos de teste de emissores comuns:

| Cartão (BIN) | Valor | 1x | 2x | 3x | máx. parcelas |
|---|---|---|---|---|---|
| Mastercard Nubank (516292) | R$ 24,90 | 0% | **9,64%** (2×13,65 = 27,30) | **11,23%** (3×9,23 = 27,70) | 12 |
| Visa Banco do Brasil (498442) | R$ 24,90 / 299 / 1.000 | 0% | 9,64% | 11,23% | 18 |
| Mastercard (552289) | R$ 100 / 300 | 0% | 9,64% | 11,23% | 18 |
| Visa (423564), Elo (506776), Mastercard (545316) | — | 0% | só 1x | — | 1 |

Os números são os mesmos em R$ 24,90, 100, 299 e 1.000 e nos três emissores com parcelamento.

## Conclusão
- **Para esses cartões, o Mercado Pago está oferecendo 2x e 3x COM juros** (9,64% e 11,23%). Isso é forte indício de que o "Parcelado vendedor" (3x sem acréscimo) **não está ativo** na conta, e portanto a frase "até 3x sem juros" do site **não é verdadeira hoje** para o cliente.
- Limites da prova: usei BINs públicos de teste, não o seu cartão; e a consulta mostra o que o MP oferece, não o painel da conta. Por isso a confirmação final é no painel ou numa compra real (o teste do cartão 3DS também mostra isso: na tela de parcelas aparece "2x de … (total R$ …)").

## O que o Hector deve fazer (escolha uma)
**A. Ativar o parcelamento sem juros no Mercado Pago** (mantém a frase do site):
1. Mercado Pago → **Seu negócio → Custos → Parcelamento sem juros** (ou "Oferecer parcelas sem juros").
2. Ative até **3 parcelas** "pago por você" (você absorve o custo). Veja a tarifa que isso gera antes de confirmar.
3. Me avise. Eu repito a consulta acima: o esperado é `installment_rate = 0` em 2x e 3x.

**B. Não oferecer sem juros:** me autorize a trocar o texto. É uma mudança em um único arquivo (`pricing.ts`) mais o texto de `/termos`, com teste, e as parcelas passam a aparecer como "podem incluir juros".

Até uma das duas, a loja está anunciando algo que o checkout não cumpre (risco com o CDC, art. 37).
