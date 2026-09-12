import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Termos de Uso',
  description:
    'Condições de compra na Lojas Schimitz: preços, frete, pagamentos PIX/cartão e trocas.',
};

const UPDATED = '12 de setembro de 2026';

export default function TermosPage() {
  return (
    <article style={{ padding: '22px 0', maxWidth: 720 }}>
      <h1>Termos de Uso</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Última atualização: {UPDATED}
      </p>

      <p>
        Ao usar o site <strong>lojasschimitz.com.br</strong> ou o aplicativo Android que abre a
        loja, você concorda com estes termos. A Lojas Schimitz é uma loja online (e marketplace de
        vendedores quando essa função estiver ativa), operada por pessoa física — contato:{' '}
        <a href="mailto:schimitzclaiton@gmail.com">schimitzclaiton@gmail.com</a> · WhatsApp{' '}
        <a href="https://wa.me/5551996253766" target="_blank" rel="noreferrer">
          (51) 99625-3766
        </a>
        .
      </p>

      <section style={{ marginTop: 22 }}>
        <h2 style={{ fontSize: 18 }}>Conta</h2>
        <p>
          Para comprar você precisa de conta com e-mail e senha válidos. Você é responsável por
          manter a senha em sigilo e pelos pedidos feitos na sua conta. Contas usadas para abuso
          (fraude, spam, ataques) podem ser bloqueadas.
        </p>
      </section>

      <section style={{ marginTop: 22 }}>
        <h2 style={{ fontSize: 18 }}>Produtos e preços</h2>
        <ul style={{ lineHeight: 1.8, paddingLeft: 18 }}>
          <li>
            Preços e estoque exibidos no site são os vigentes no momento da compra; podem mudar
            sem aviso prévio para novos pedidos.
          </li>
          <li>
            Em produtos de marketplace, o anúncio pode ser de um vendedor parceiro; a Lojas
            Schimitz organiza a experiência da loja, e o detalhe do vendedor aparece quando
            aplicável.
          </li>
          <li>
            Erros evidentes de preço (ex.: valor irrisório por falha técnica) podem levar ao
            cancelamento do pedido com estorno, mediante contato.
          </li>
        </ul>
      </section>

      <section style={{ marginTop: 22 }}>
        <h2 style={{ fontSize: 18 }}>Frete e entrega</h2>
        <ul style={{ lineHeight: 1.8, paddingLeft: 18 }}>
          <li>
            Frete é calculado no checkout conforme o CEP. Em Porto Alegre (CEP iniciando em 90)
            costuma haver frete grátis, conforme a regra vigente na loja.
          </li>
          <li>
            Prazos são estimativas. Após o pagamento, o status do pedido (separando, enviado,
            entregue) fica em <Link href="/pedidos">Meus pedidos</Link>.
          </li>
          <li>
            É importante informar endereço completo e telefone para facilitar a entrega e o
            contato.
          </li>
        </ul>
      </section>

      <section style={{ marginTop: 22 }}>
        <h2 style={{ fontSize: 18 }}>Pagamentos</h2>
        <ul style={{ lineHeight: 1.8, paddingLeft: 18 }}>
          <li>
            Aceitamos <strong>PIX</strong> (com desconto à vista quando a promoção estiver ativa —
            hoje 5%) e <strong>cartão</strong> em até 12x via <strong>Mercado Pago</strong>.
          </li>
          <li>
            O pagamento é processado pelo Mercado Pago. A confirmação do pedido depende da
            aprovação do pagamento.
          </li>
          <li>
            Pedidos aguardando pagamento podem expirar se o PIX/cartão não for concluído a tempo.
          </li>
        </ul>
      </section>

      <section style={{ marginTop: 22 }}>
        <h2 style={{ fontSize: 18 }}>Trocas e devoluções</h2>
        <p>
          Troca em até <strong>7 dias</strong>, conforme as regras da loja e o estado do produto
          (sem uso indevido, com acessórios e nota/pedido). Para iniciar troca, devolução ou
          cancelamento, fale pelo WhatsApp{' '}
          <a href="https://wa.me/5551996253766" target="_blank" rel="noreferrer">
            (51) 99625-3766
          </a>{' '}
          ou pela página <Link href="/suporte">Suporte</Link>, informando o número do pedido.
        </p>
      </section>

      <section style={{ marginTop: 22 }}>
        <h2 style={{ fontSize: 18 }}>Uso aceitável</h2>
        <p>
          Não use o site para fins ilegais, para explorar falhas de segurança ou para automatizar
          compras de forma abusiva. Conteúdo do catálogo e da marca Lojas Schimitz não deve ser
          republicado como se fosse seu sem autorização.
        </p>
      </section>

      <section style={{ marginTop: 22 }}>
        <h2 style={{ fontSize: 18 }}>Limitação</h2>
        <p>
          Fazemos o possível para manter o site no ar e os dados corretos, mas indisponibilidade
          temporária, atraso de transportadora ou falha de terceiros (ex.: processador de
          pagamento) podem ocorrer. Em caso de problema, o canal principal é o WhatsApp/e-mail
          acima.
        </p>
      </section>

      <section style={{ marginTop: 22 }}>
        <h2 style={{ fontSize: 18 }}>Privacidade</h2>
        <p>
          O tratamento de dados pessoais está descrito na{' '}
          <Link href="/privacidade">Política de Privacidade</Link>.
        </p>
      </section>

      <section style={{ marginTop: 22 }}>
        <h2 style={{ fontSize: 18 }}>Lei aplicável</h2>
        <p>
          Estes termos são interpretados conforme a legislação brasileira. Foro preferencial: Porto
          Alegre / RS, salvo regra legal em contrário (ex.: consumidor).
        </p>
      </section>

      <p className="muted" style={{ marginTop: 28 }}>
        Veja também: <Link href="/privacidade">Privacidade</Link> ·{' '}
        <Link href="/suporte">Suporte</Link>
      </p>
    </article>
  );
}
