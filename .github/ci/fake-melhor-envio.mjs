// Servidor FALSO do Melhor Envio, só para CI/testes locais.
// Responde qualquer POST de cotação com um único serviço fixo (PAC R$ 20,00, 5 dias).
// Nunca usa token real nem rede externa. Uso:
//   node .github/ci/fake-melhor-envio.mjs &   (porta: FAKE_ME_PORT, padrão 45999)
//   MELHOR_ENVIO_TOKEN=fake-local MELHOR_ENVIO_BASE_URL=http://127.0.0.1:45999
import { createServer } from 'node:http';

const port = Number(process.env.FAKE_ME_PORT || 45999);
const quote = [
  {
    id: 1,
    name: 'PAC',
    price: '20.00',
    custom_price: '20.00',
    delivery_time: 5,
    custom_delivery_time: 5,
    company: { name: 'Correios' },
  },
];

createServer((req, res) => {
  req.resume();
  req.on('end', () => {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(quote));
  });
}).listen(port, '127.0.0.1', () => {
  console.log(`fake Melhor Envio em http://127.0.0.1:${port}`);
});
