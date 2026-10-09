# CSP × antifraude do Mercado Pago: evidência de 09/10/2026

## Pergunta
O `frame-src`/`connect-src` da loja bloqueia o device fingerprint (antifraude) do Mercado Pago? Precisa liberar `*.mercadolivre.com` ou outro domínio?

## Método
O script é `apps/web/scripts/csp-probe-mp.mjs`. Ele usa Chrome headless e Playwright.
- Página mínima servida com a **CSP exata de produção**, copiada do header de `https://lojasschimitz.com.br/` em 09/10.
- A página carrega `https://sdk.mercadopago.com/js/v2` e monta o **cardPayment Brick** com a chave **pública** de produção (a mesma que vai no bundle do site), sem submit.
- O script digita um cartão de **teste** público do MP nos Secure Fields, o que dispara a consulta de BIN e de parcelas.
- **Origem real:** com `--host-resolver-rules` e TLS autoassinado na porta 443, a página roda como `https://lojasschimitz.com.br`. Assim o MP vê a mesma origem da loja.
- Três rodadas: sem CSP (linha de base), com a CSP de produção e com a CSP de produção **sem `'unsafe-eval'`**.

## Resultado
| Rodada | Brick `onReady` | Erro do Brick | `securitypolicyviolation` | "Refused…" no console |
|---|---|---|---|---|
| sem CSP | sim | nenhum | 0 | 0 |
| CSP de produção | sim | nenhum | **0** | **0** |
| CSP de produção sem `'unsafe-eval'` | sim | nenhum | **0** | **0** |

Hosts que o Brick e o antifraude pediram a partir da página da loja:
- **script:** `sdk.mercadopago.com`, `http2.mlstatic.com`
- **connect** (xhr/fetch):
  - `api.mercadopago.com`
  - `api.mercadolibre.com` (`/tracks`)
  - `www.mercadolibre.com` (`/jms/lgz/background/etid`, `/jms/lgz/fingerprint/high/armor…`)
  - `http2.mlstatic.com`
  - `secure-fields.mercadopago.com`
- **frame:** `secure-fields.mercadopago.com` (3 iframes: número, validade e CVV)
- **img** (pixel do fingerprint):
  - `www.mercadolibre.com`
  - `www.mercadopago.com.br`
  - `www.mercadolivre.com` (só apareceu na rodada a partir de `localhost`)

Todos já estão cobertos pela política atual:
- `connect-src` tem `https://*.mercadolibre.com`;
- `img-src` aceita `https:`;
- `frame-src` tem `secure-fields.mercadopago.com`.

Algumas chamadas de telemetria e fingerprint (`api.mercadolibre.com/tracks`, `www.mercadolibre.com/jms/lgz/...`) falham **também sem CSP**. O motivo é **CORS do lado do MP** ("No 'Access-Control-Allow-Origin' header"). Não é a nossa CSP e não temos como corrigir isso daqui. O Brick fica pronto e consulta BIN e parcelas normalmente.

## Conclusão
- **Nenhum domínio novo é comprovadamente necessário.** A hipótese de que o `frame-src` bloqueia o antifraude **não se confirmou**, e a política não mudou.
- A spec `apps/web/src/lib/storefront-csp-mp-observed.spec.ts` trava os hosts observados. Se alguém apertar a CSP e cortar um deles, o CI falha.
- Sem `'unsafe-eval'`, o Brick também montou sem nenhuma violação. A remoção está num PR separado em **draft** e só deve ser mesclada depois do teste real de cartão (3DS e emissor não foram exercitados aqui).

## Limites
Foi Chrome headless num ambiente de servidor. Não houve tokenização nem pagamento, e o desafio 3DS do emissor não foi testado. Os relatórios de CSP da produção (`csp_violation` nos logs da API) estavam vazios no período de logs disponível.
