# Checkout → página do pedido

Antes, a página do pedido só pedia `GET /orders/:id` depois de baixar o próprio código e montar
(rede em série). Agora o checkout dispara essa mesma leitura assim que o `POST /orders` responde, e
a página usa a resposta na 1ª carga (uso único, mesmo pedido, < 10 s). A lógica de pagamento e de
pedido não mudou; as recargas seguintes continuam buscando da API.

Medição local (Postgres + API + `next start`, CPU 4×, RTT 150 ms, cache limpo antes do clique, 7 execuções, mediana):

| | antes (main) | depois |
|---|---|---|
| POST /orders | 204 ms | 217 ms |
| URL muda | 646 ms | 663 ms |
| botão "Pagar com PIX" visível | **893 ms** | **737 ms** (−156 ms) |
