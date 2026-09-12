import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Política de Privacidade',
  description:
    'Como a Lojas Schimitz trata dados de conta, pedidos, pagamentos e cookies no site e no app.',
};

const UPDATED = '12 de setembro de 2026';

export default function PrivacidadePage() {
  return (
    <article style={{ padding: '22px 0', maxWidth: 720 }}>
      <h1>Política de Privacidade</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Última atualização: {UPDATED}
      </p>

      <p>
        Esta página explica, de forma direta, quais dados a <strong>Lojas Schimitz</strong> usa
        quando você acessa o site{' '}
        <a href="https://lojasschimitz.com.br">lojasschimitz.com.br</a> ou o aplicativo Android
        (Trusted Web Activity / Play Store) que abre a mesma loja.
      </p>

      <section style={{ marginTop: 22 }}>
        <h2 style={{ fontSize: 18 }}>Quem opera a loja</h2>
        <p>
          A loja é operada por pessoa física (sem CNPJ nesta versão). Contato para dúvidas sobre
          privacidade, pedidos ou exclusão de conta:
        </p>
        <ul style={{ lineHeight: 1.8, paddingLeft: 18 }}>
          <li>
            E-mail:{' '}
            <a href="mailto:schimitzclaiton@gmail.com">schimitzclaiton@gmail.com</a>
          </li>
          <li>
            WhatsApp:{' '}
            <a href="https://wa.me/5551996253766" target="_blank" rel="noreferrer">
              (51) 99625-3766
            </a>
          </li>
          <li>
            Site:{' '}
            <a href="https://lojasschimitz.com.br">https://lojasschimitz.com.br</a>
          </li>
        </ul>
      </section>

      <section style={{ marginTop: 22 }}>
        <h2 style={{ fontSize: 18 }}>Dados que coletamos</h2>
        <ul style={{ lineHeight: 1.8, paddingLeft: 18 }}>
          <li>
            <strong>Conta</strong> — nome, e-mail e senha (a senha é armazenada com hash seguro,
            nunca em texto puro). Telefone é opcional e ajuda no atendimento por WhatsApp.
          </li>
          <li>
            <strong>Endereços e pedidos</strong> — CEP, rua, número, complemento, bairro, cidade e
            UF para calcular frete e entregar. No pedido guardamos um snapshot desses dados e o
            histórico de status (pago, enviado, entregue etc.).
          </li>
          <li>
            <strong>Pagamentos</strong> — processados pelo <strong>Mercado Pago</strong> (PIX ou
            cartão). Nós registramos o pedido, o método e o status do pagamento. Dados sensíveis de
            cartão (número completo, CVV) ficam com o Mercado Pago; não armazenamos o cartão na
            loja.
          </li>
          <li>
            <strong>Sessão e cookies</strong> — usamos cookie HttpOnly de atualização de sessão (
            <code>sch_refresh</code>) e um token de acesso de curta duração no navegador/app para
            manter você logado. Também usamos armazenamento local do navegador para o token de
            acesso e, em alguns casos, fallback de sessão.
          </li>
          <li>
            <strong>Chat do site</strong> — mensagens enviadas no assistente do site para FAQ,
            catálogo e encaminhamento humano.
          </li>
          <li>
            <strong>Logs técnicos</strong> — IP, data/hora e identificador de requisição para
            segurança (ex.: limitar tentativas de login) e diagnóstico. Não usamos esses logs para
            propaganda.
          </li>
        </ul>
      </section>

      <section style={{ marginTop: 22 }}>
        <h2 style={{ fontSize: 18 }}>Para que usamos</h2>
        <ul style={{ lineHeight: 1.8, paddingLeft: 18 }}>
          <li>Criar e autenticar sua conta.</li>
          <li>Processar pedidos, frete e pagamentos.</li>
          <li>
            Enviar avisos transacionais por e-mail (quando o SMTP estiver configurado), por exemplo
            pedido pago ou enviado, e notificar administradores sobre nova venda.
          </li>
          <li>
            Atendimento por WhatsApp: o lojista pode abrir um link <em>wa.me</em> com mensagem
            pronta (click-to-chat). Não há envio automático pela API do WhatsApp nesta versão.
          </li>
          <li>Prevenir abuso (rate limit, tentativas de login) e manter a loja funcionando.</li>
        </ul>
      </section>

      <section style={{ marginTop: 22 }}>
        <h2 style={{ fontSize: 18 }}>Com quem compartilhamos</h2>
        <ul style={{ lineHeight: 1.8, paddingLeft: 18 }}>
          <li>
            <strong>Mercado Pago</strong> — processador de pagamento (PIX/cartão). Sujeito à
            política deles.
          </li>
          <li>
            <strong>Infraestrutura de hospedagem</strong> — servidores e banco onde a loja roda
            (dados de conta e pedidos ficam lá para operar o serviço).
          </li>
          <li>
            <strong>WhatsApp / Meta</strong> — só quando você ou o lojista abre o aplicativo
            WhatsApp pelo link de conversa; a mensagem é enviada por você/lojista, não por um
            robô nosso.
          </li>
          <li>
            Não vendemos sua lista de e-mails. Não fazemos remarketing com parceiros de anúncio
            nesta versão.
          </li>
        </ul>
      </section>

      <section style={{ marginTop: 22 }}>
        <h2 style={{ fontSize: 18 }}>Cookies e sessão (Play / site)</h2>
        <p>
          O app na Play Store abre o site da loja. Cookies e armazenamento local citados acima
          servem para login e sessão. Sem eles, você precisaria entrar de novo a cada visita.
          Você pode limpar cookies/dados do site no navegador ou nas configurações do Android;
          ao fazer logout no site, o cookie de refresh é revogado.
        </p>
      </section>

      <section style={{ marginTop: 22 }}>
        <h2 style={{ fontSize: 18 }}>Retenção e seus direitos</h2>
        <p>
          Mantemos dados de conta e pedidos enquanto a conta existir e pelo tempo necessário para
          obrigações comerciais (histórico de compra, suporte, contestação de pagamento). Você pode
          pedir correção de dados em <Link href="/conta">Minha conta</Link> ou pelo e-mail/WhatsApp
          acima. Para excluir a conta ou obter uma cópia dos dados que temos, escreva para{' '}
          <a href="mailto:schimitzclaiton@gmail.com">schimitzclaiton@gmail.com</a> — vamos atender
          no que for possível sem apagar registros que a lei ou o pagamento ainda exigem guardar.
        </p>
      </section>

      <section style={{ marginTop: 22 }}>
        <h2 style={{ fontSize: 18 }}>Menores</h2>
        <p>
          A loja não é direcionada a crianças. Pedidos e cadastros pressupõem capacidade civil
          para comprar.
        </p>
      </section>

      <section style={{ marginTop: 22 }}>
        <h2 style={{ fontSize: 18 }}>Alterações</h2>
        <p>
          Se mudarmos práticas relevantes (novo processador de pagamento, coleta extra etc.),
          atualizamos esta página e a data no topo.
        </p>
      </section>

      <p className="muted" style={{ marginTop: 28 }}>
        Veja também: <Link href="/termos">Termos de uso</Link> ·{' '}
        <Link href="/suporte">Suporte</Link>
      </p>
    </article>
  );
}
