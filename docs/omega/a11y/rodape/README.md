# Rodapé: alvos de toque ≥ 48 px

Antes: links do rodapé com 16 px de altura (mín. 35 px de largura), linhas a ~23 px uma da outra. Lighthouse mobile
`target-size` reprovado (6 links: Ofertas, Salvos, Excluir conta, Meus pedidos, Minha conta, WhatsApp), acessibilidade 96 na home, 91 em /produtos.

Mudança (só `pointer: coarse`): cada link de `.footer-col` vira linha flex de `min-height: 48px`; listas de links sem o gap de 7 px.
Mesma fonte (13 px), cor (#fff) e alinhamento. Lista "Benefícios" (sem links) intacta. Desktop: screenshot idêntico byte a byte.

Depois: 12 links com 48 px × ≥188 px; `target-size` aprovado (0 falhas); acessibilidade home 96 → 100, /produtos 91 → 95.
Rodapé no celular fica 723 → 905 px mais alto (mais espaço entre linhas — efeito inevitável de alvos de 48 px sem sobreposição).
