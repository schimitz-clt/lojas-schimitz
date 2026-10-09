/**
 * Texto da Política de Privacidade (/privacidade). Fonte única: a página só renderiza isto.
 * Cada afirmação aqui foi conferida no código em 09/10/2026 (ver PR). Mudou o que o sistema
 * coleta? Atualize este arquivo, PRIVACY_POLICY_UPDATED e o spec.
 */
export const PRIVACY_POLICY_UPDATED = '9 de outubro de 2026 (revisão 2)';
export const ACCOUNT_DELETION_PATH = '/excluir-conta';

export type PrivacyRow = { data: string; why: string; basis: string };
export type PrivacySection = {
  id: string;
  title: string;
  paragraphs?: string[];
  items?: string[];
  rows?: PrivacyRow[];
};

export const PRIVACY_INTRO =
  'Esta política explica quais dados pessoais a Lojas Schimitz trata quando você usa o site lojasschimitz.com.br ou o aplicativo Android da loja, para que usamos, com quem compartilhamos, por quanto tempo guardamos e como você exerce seus direitos pela Lei Geral de Proteção de Dados (LGPD, Lei 13.709/2018). O aplicativo Android é um app nativo que abre o próprio site da loja dentro de um WebView: os dados e as regras são os mesmos do site.';

export const PRIVACY_SECTIONS: PrivacySection[] = [
  {
    id: 'dados',
    title: 'Quais dados tratamos, para quê e com qual base legal',
    rows: [
      {
        data: 'Cadastro: nome completo, e-mail, senha, CPF, data de nascimento e telefone/WhatsApp (opcional)',
        why: 'Criar e proteger sua conta, identificar o comprador, confirmar que você tem 18 anos ou mais e evitar cadastros duplicados ou fraudulentos. A senha é guardada só como hash (argon2), nunca em texto puro.',
        basis: 'Execução de contrato (art. 7º, V) e legítimo interesse na prevenção a fraudes (art. 7º, IX)',
      },
      {
        data: 'Endereços de entrega (CEP, rua, número, complemento, bairro, cidade, UF)',
        why: 'Calcular o frete e entregar. Cada pedido guarda uma cópia do endereço usado.',
        basis: 'Execução de contrato (art. 7º, V)',
      },
      {
        data: 'Pedidos e pagamentos: itens, valores, cupons, status do pedido, método e status do pagamento, código do pagamento no Mercado Pago e, quando houver, a origem da campanha (UTM) que trouxe você',
        why: 'Processar a compra, emitir comprovantes, atender trocas, estornos e contestações, e manter a contabilidade da loja.',
        basis: 'Execução de contrato (art. 7º, V), cumprimento de obrigação legal (art. 7º, II) e exercício regular de direitos (art. 7º, VI)',
      },
      {
        data: 'Dados de cartão',
        why: 'Pagar com cartão. Número, validade e código de segurança são digitados no formulário do Mercado Pago e vão direto para ele. A loja não recebe nem guarda o número do cartão.',
        basis: 'Execução de contrato (art. 7º, V), tratado pelo Mercado Pago',
      },
      {
        data: 'Notificações no app Android: identificador do aparelho para notificações (token do Firebase Cloud Messaging), versão do app e um código interno do aparelho',
        why: 'Enviar avisos de pedidos e ofertas. O token só é enviado à loja quando as notificações do app estão permitidas no Android (no Android 13 ou mais novo o sistema pergunta; em versões anteriores elas vêm ligadas por padrão). Você pode desligar a qualquer momento nas configurações do celular.',
        basis: 'Consentimento (art. 7º, I), dado pela permissão de notificações do Android',
      },
      {
        data: 'Produtos vistos: no app Android com notificações registradas, quais produtos foram abertos e quando, ligados ao código do aparelho (e à sua conta, se estiver logado)',
        why: 'Lembrar por notificação de um produto que você viu e não comprou. A lista "Vistos recentemente" do site fica só no seu navegador e não é enviada à loja.',
        basis: 'Legítimo interesse (art. 7º, IX), com opção de desligar as notificações',
      },
      {
        data: 'Avaliações de produtos: nota, texto e o nome do seu cadastro',
        why: 'Publicar a avaliação na página do produto, junto com o seu nome. Só quem comprou o produto pode avaliar.',
        basis: 'Consentimento (art. 7º, I), ao enviar a avaliação',
      },
      {
        data: 'Favoritos, carrinho e cupons usados',
        why: 'Guardar sua lista de salvos e o carrinho entre visitas e aplicar descontos.',
        basis: 'Execução de contrato (art. 7º, V)',
      },
      {
        data: 'Mensagens do assistente de chat do site',
        why: 'Responder dúvidas sobre produtos, frete e pedidos. A conversa fica no seu navegador (sessão) e não é salva no banco da loja. Para gerar a resposta, o texto pode ser enviado ao provedor de inteligência artificial (OpenAI). Não escreva CPF, senha ou dados de cartão no chat.',
        basis: 'Legítimo interesse (art. 7º, IX), no atendimento que você mesmo pediu',
      },
      {
        data: 'Registros técnicos: endereço IP, data e hora, páginas e chamadas da API, identificador da requisição e relatórios de erro do navegador',
        why: 'Segurança (por exemplo, limitar tentativas de login e redefinição de senha), diagnóstico de falhas e prevenção de abuso. Não usamos esses registros para publicidade.',
        basis: 'Legítimo interesse (art. 7º, IX)',
      },
    ],
  },
  {
    id: 'cookies',
    title: 'Cookies e armazenamento no aparelho',
    items: [
      'sch_access e sch_refresh: cookies de sessão (HttpOnly) que mantêm você logado. O de refresh vale até 30 dias e é revogado quando você sai da conta.',
      'sch_push_device: no app Android, guarda o código interno do aparelho para registrar produtos vistos. Não contém o token de notificação nem sua senha.',
      'Armazenamento local do navegador: seu nome e e-mail para a interface (sem senha e sem token), o carrinho de visitante, a lista de produtos vistos recentemente e a conversa do chat na sessão. Esses dados ficam no seu aparelho; você pode apagá-los limpando os dados do navegador ou do app.',
      'Hoje a loja não usa cookies de publicidade nem ferramentas de análise de terceiros (como Google Analytics ou Meta Pixel). Se isso mudar, esta política será atualizada antes.',
    ],
  },
  {
    id: 'compartilhamento',
    title: 'Com quem compartilhamos (operadores)',
    paragraphs: [
      'Não vendemos nem alugamos seus dados. Compartilhamos apenas o necessário com empresas que prestam serviço para a loja (operadores), cada uma com a própria política de privacidade:',
    ],
    items: [
      'Mercado Pago: processa PIX e cartão. Recebe valor, descrição do pedido, seu e-mail e os dados digitados no formulário de pagamento.',
      'Melhor Envio: cota o frete. Recebe o CEP de origem, o CEP de destino e as medidas e o peso dos pacotes (não recebe seu nome).',
      'Resend: envia os e-mails da loja (pedido recebido, pago, enviado, redefinição de senha). Recebe seu e-mail, seu nome e o conteúdo da mensagem.',
      'Google Firebase Cloud Messaging: entrega as notificações do app Android. Recebe o token de notificação do aparelho e o texto da notificação.',
      'OpenAI: gera as respostas do assistente de chat do site. Recebe o texto da conversa.',
      'Railway: hospeda o site, a API e o banco de dados onde ficam conta, pedidos e registros.',
      'WhatsApp (Meta): só quando você ou a loja abre uma conversa pelo link do WhatsApp. A mensagem é enviada por pessoas, não por um robô da loja.',
      'Autoridades: quando a lei ou uma ordem judicial exigir.',
    ],
  },
  {
    id: 'transferencia',
    title: 'Transferência internacional',
    paragraphs: [
      'Alguns operadores (Railway, Resend, Google Firebase e OpenAI) processam dados em servidores fora do Brasil, principalmente nos Estados Unidos. Essa transferência é necessária para prestar o serviço que você contratou e segue as garantias contratuais desses fornecedores (art. 33 da LGPD).',
    ],
  },
  {
    id: 'retencao',
    title: 'Por quanto tempo guardamos',
    items: [
      'Conta, endereços, favoritos, notificações e produtos vistos: enquanto a conta existir. Quando você pede a exclusão da conta, esses dados são apagados ou anonimizados (veja "Excluir sua conta").',
      'Pedidos, pagamentos, estornos e registros financeiros: 5 anos depois da compra, para cumprir obrigações legais, fiscais e de defesa do consumidor e para responder a contestações. Depois disso podem ser apagados ou anonimizados.',
      'Sessões: o cookie de refresh expira em até 30 dias; links de redefinição de senha expiram em 1 hora.',
      'Token de notificação e produtos vistos no app: enquanto o aparelho estiver registrado. O token é desativado quando o Firebase informa que ele deixou de valer (por exemplo, depois de desinstalar o app), e tudo é apagado quando você pede a exclusão da conta ou pelos canais abaixo.',
      'Registros técnicos (logs com IP, data e hora): ficam só no painel do provedor de hospedagem (Railway) e são apagados automaticamente por ele no prazo do plano contratado (7 dias no plano Hobby, 30 dias no Pro). A loja não exporta nem guarda cópia própria desses registros.',
    ],
  },
  {
    id: 'direitos',
    title: 'Seus direitos (art. 18 da LGPD)',
    items: [
      'Confirmar se tratamos seus dados e acessar uma cópia deles.',
      'Corrigir dados incompletos ou errados. Nome e telefone podem ser alterados em Minha conta → Dados pessoais.',
      'Pedir anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desacordo com a LGPD.',
      'Portabilidade dos dados a outro fornecedor.',
      'Saber com quem compartilhamos seus dados.',
      'Revogar o consentimento (por exemplo, desligar as notificações) e se opor a tratamentos baseados em legítimo interesse.',
      'Pedir a exclusão da conta: veja a página Excluir conta.',
      'Reclamar à Autoridade Nacional de Proteção de Dados (ANPD), em gov.br/anpd.',
    ],
    paragraphs: [
      'Para exercer qualquer direito, use os canais abaixo. Podemos pedir a confirmação de identidade (por exemplo, que a mensagem venha do e-mail ou telefone cadastrado) para proteger sua conta. Respondemos em até 15 dias.',
    ],
  },
  {
    id: 'seguranca',
    title: 'Segurança',
    items: [
      'Conexão sempre criptografada (HTTPS). O app Android bloqueia conexões sem criptografia.',
      'Senhas guardadas só como hash; os tokens de sessão ficam em cookies HttpOnly, fora do alcance de scripts.',
      'Limite de tentativas de login e de redefinição de senha.',
      'Acesso ao painel da loja restrito à equipe, com registro de auditoria das operações financeiras.',
    ],
  },
  {
    id: 'menores',
    title: 'Menores de idade',
    paragraphs: [
      'A loja não é direcionada a crianças e adolescentes. O cadastro exige 18 anos ou mais.',
    ],
  },
  {
    id: 'alteracoes',
    title: 'Alterações desta política',
    paragraphs: [
      'Se mudarmos o que coletamos ou com quem compartilhamos (por exemplo, um novo meio de pagamento ou ferramenta de análise), atualizamos esta página e a data no topo antes da mudança.',
    ],
  },
];

/** Plain-text version (for review docs and tests). */
export function privacyPolicyPlainText(contact: { lines: string[] }): string {
  const out: string[] = ['Política de Privacidade', `Última atualização: ${PRIVACY_POLICY_UPDATED}`, '', PRIVACY_INTRO, ''];
  out.push('Quem é o controlador e como falar com a gente');
  out.push(...contact.lines.map((l) => `- ${l}`), '');
  for (const s of PRIVACY_SECTIONS) {
    out.push(s.title);
    for (const r of s.rows || []) out.push(`- ${r.data}. Para quê: ${r.why} Base legal: ${r.basis}.`);
    for (const p of s.paragraphs || []) out.push(p);
    for (const i of s.items || []) out.push(`- ${i}`);
    out.push('');
  }
  out.push(`Excluir sua conta: https://lojasschimitz.com.br${ACCOUNT_DELETION_PATH}`);
  return out.join('\n');
}
