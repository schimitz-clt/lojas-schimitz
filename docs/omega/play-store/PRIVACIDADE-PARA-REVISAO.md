# /privacidade e /excluir-conta: texto em produção, para revisão do Hector

Atualizado em 09/10/2026 (fim da tarde). Os textos das seções 3 e 4 foram **gerados do código do `main`**, o mesmo que está no ar:
- #186 (/privacidade) e #187 (/excluir-conta) foram mesclados com a sua autorização.
- Depois vieram #188 (retenção real dos logs), #189 (limpeza de produtos vistos em 90 dias), #190 (avaliações com primeiro nome + inicial) e #194 (pergunta de notificação no Android 12 ou anterior).

Este arquivo não é aconselhamento jurídico. Se puder, peça a um advogado para olhar os prazos e as bases legais.

## 1. Afirmações que você precisa confirmar (ou mandar corrigir)

| # | O que o texto afirma | Por que pedir confirmação |
|---|---|---|
| 1 | O controlador aparece como **"Lojas Schimitz"**, sem CNPJ, endereço nem e-mail. O texto antigo dizia "pessoa física (sem CNPJ)" e trazia um e-mail Gmail fixo; os dois foram **removidos**. | Para mostrar esses dados, defina no serviço **web** (o build precisa ser refeito): `NEXT_PUBLIC_STORE_LEGAL_NAME`, `NEXT_PUBLIC_STORE_CNPJ` (validado, 14 dígitos), `NEXT_PUBLIC_STORE_ADDRESS` e `NEXT_PUBLIC_STORE_PRIVACY_EMAIL`. Sem essas variáveis, só o WhatsApp aparece. A LGPD pede a identidade do controlador; vale pôr pelo menos o nome do responsável. |
| 2 | O canal de privacidade é o **WhatsApp (51) 99625-3766**. | É o número que já está no site (`DEFAULT_STORE_WHATSAPP`). |
| 3 | **Resposta aos pedidos do titular em até 15 dias** e **exclusão de conta processada em até 15 dias**. | O prazo é uma decisão sua (a LGPD fala em 15 dias para a confirmação completa, art. 19, II). |
| 4 | **Pedidos, pagamentos, estornos, cashback e auditoria ficam guardados por 5 anos** depois da compra. | Prazo usual (CDC/fiscal), mas confirme com o seu contador. O sistema **não apaga nada sozinho** depois de 5 anos: hoje isso seria manual. |
| 5 | **Logs técnicos** (IP, data e hora) ficam só no painel do Railway e são apagados por ele no prazo do plano (7 dias no Hobby, 30 no Pro). A loja não exporta nem guarda cópia. | **Corrigido (#188).** A frase dos "6 meses" saiu. Confirme o seu plano no Railway: se não for Hobby nem Pro, o prazo do texto muda. Se o Marco Civil (art. 15) se aplicar a você, seria preciso um arquivo próprio de 6 meses, que **não existe**. |
| 6 | O texto cita a **OpenAI** como operadora do chat do site. | No código, o chat chama a API da OpenAI quando `OPENAI_API_KEY` existe (a variável existe em produção). Se você desligar o chat com IA, tire esse item. |
| 7 | O texto cita a **Resend** como provedora de e-mail. | Produção tem `RESEND_API_KEY`. Também existem variáveis de SMTP; se o envio real for por outro provedor, troque o nome. |
| 8 | Os operadores com servidores fora do Brasil (Railway, Resend, Firebase, OpenAI) estão "principalmente nos Estados Unidos". | O Railway de produção está na região `iad` (EUA). |
| 9 | **Não há** Google Analytics nem Meta Pixel. | Conferido no HTML da home em 09/10/2026. O código suporta os dois (`NEXT_PUBLIC_GA_MEASUREMENT_ID`, `NEXT_PUBLIC_META_PIXEL_ID`). **Se você ligar qualquer um, a política e a ficha da Play precisam mudar antes.** |
| 10 | O cadastro exige **18 anos ou mais**. | É o que o código faz hoje. |
| 11 | **Só quem comprou o produto pode avaliar**. A avaliação aparece com **o primeiro nome e a inicial do último sobrenome** (ex.: "Maria S."). | **Corrigido (#190).** A API pública não devolve mais o nome completo nem o id do usuário. |
| 12 | Para as notificações, a base legal é o **consentimento**. No Android 13 ou mais novo o sistema pergunta. No Android 12 ou anterior, **a partir da versão 1.0.13** o próprio app pergunta antes de enviar o token. | **Corrigido no código (#194)**, mas só chega aos aparelhos com o **AAB 1.0.13 (versionCode 14)**. Até a 1.0.12 o token era enviado sem pergunta, e o texto diz isso. |
| 13 | **Produtos vistos** no app (e o registro dos lembretes enviados) são apagados automaticamente **90 dias** depois da última visualização. | **Corrigido (#189).** Um job apaga a cada 6 horas o que passou de 90 dias. |
| 14 | O **saldo de cashback não usado é perdido** com a exclusão da conta. | É uma decisão comercial sua. O fluxo não zera o saldo no banco; a conta só fica bloqueada. |
| 15 | Se houver **pedido em andamento**, a exclusão espera ele ser entregue ou cancelado. | É o que a API faz (retorna 409 enquanto houver pedido aberto). |
| 16 | Quem não consegue entrar pode pedir a exclusão **pelo WhatsApp**. | Confirme a identidade (por exemplo, a mensagem vem do telefone cadastrado ou o cliente responde a um e-mail enviado ao endereço do cadastro). Depois, em **Admin → Clientes → Pedidos de exclusão**, digite o e-mail do cadastro em "Abrir pedido" e processe normalmente. |

## 2. O que fica pendente do seu lado
1. Ler os textos abaixo e mandar correções, se houver. Eles já estão no ar.
2. Confirmar o **plano do Railway** (prazo dos logs, item 5).
3. Opcional: definir as variáveis `NEXT_PUBLIC_STORE_*` no serviço **web** (item 1). Eu não altero variáveis do Railway.
4. `STORE_NOTIFY_EMAIL` **existe** no serviço da API (conferido só pelo nome em 09/10). Os pedidos de exclusão também aparecem em **Admin → Clientes → Pedidos de exclusão de conta**.
5. Na Play Console: política = `/privacidade` e exclusão de conta = `/excluir-conta` (ver `ficha.md`, seção 4).
6. Gerar e enviar o **AAB 1.0.13** (passo a passo em `RELEASE.md`) para a pergunta de notificação chegar aos aparelhos com Android 12 ou anterior.

## 3. Texto em produção: Política de Privacidade (sem as variáveis opcionais)

```
Política de Privacidade
Última atualização: 9 de outubro de 2026 (revisão 2)

Esta política explica quais dados pessoais a Lojas Schimitz trata quando você usa o site lojasschimitz.com.br ou o aplicativo Android da loja, para que usamos, com quem compartilhamos, por quanto tempo guardamos e como você exerce seus direitos pela Lei Geral de Proteção de Dados (LGPD, Lei 13.709/2018). O aplicativo Android é um app nativo que abre o próprio site da loja dentro de um WebView: os dados e as regras são os mesmos do site.

Quem é o controlador e como falar com a gente
- Controlador: Lojas Schimitz
- WhatsApp: (51) 99625-3766 (https://wa.me/5551996253766)

Quais dados tratamos, para quê e com qual base legal
- Cadastro: nome completo, e-mail, senha, CPF, data de nascimento e telefone/WhatsApp (opcional). Para quê: Criar e proteger sua conta, identificar o comprador, confirmar que você tem 18 anos ou mais e evitar cadastros duplicados ou fraudulentos. A senha é guardada só como hash (argon2), nunca em texto puro. Base legal: Execução de contrato (art. 7º, V) e legítimo interesse na prevenção a fraudes (art. 7º, IX).
- Endereços de entrega (CEP, rua, número, complemento, bairro, cidade, UF). Para quê: Calcular o frete e entregar. Cada pedido guarda uma cópia do endereço usado. Base legal: Execução de contrato (art. 7º, V).
- Pedidos e pagamentos: itens, valores, cupons, status do pedido, método e status do pagamento, código do pagamento no Mercado Pago e, quando houver, a origem da campanha (UTM) que trouxe você. Para quê: Processar a compra, emitir comprovantes, atender trocas, estornos e contestações, e manter a contabilidade da loja. Base legal: Execução de contrato (art. 7º, V), cumprimento de obrigação legal (art. 7º, II) e exercício regular de direitos (art. 7º, VI).
- Dados de cartão. Para quê: Pagar com cartão. Número, validade e código de segurança são digitados no formulário do Mercado Pago e vão direto para ele. A loja não recebe nem guarda o número do cartão. Base legal: Execução de contrato (art. 7º, V), tratado pelo Mercado Pago.
- Notificações no app Android: identificador do aparelho para notificações (token do Firebase Cloud Messaging), versão do app e um código interno do aparelho. Para quê: Enviar avisos de pedidos e ofertas. O token só é enviado à loja quando as notificações do app estão permitidas no Android (no Android 13 ou mais novo o sistema pergunta; no Android 12 ou anterior, a partir da versão 1.0.13 do app, o próprio app pergunta antes e só envia o token se você aceitar. Até a versão 1.0.12 o token era enviado sem essa pergunta; quem disser "não" na nova versão tem o token desativado na loja). Você pode desligar a qualquer momento nas configurações do celular. Base legal: Consentimento (art. 7º, I), dado pela permissão de notificações do Android ou, no Android 12 ou anterior, pela pergunta do app.
- Produtos vistos: no app Android com notificações registradas, quais produtos foram abertos e quando, ligados ao código do aparelho (e à sua conta, se estiver logado). Para quê: Lembrar por notificação de um produto que você viu e não comprou. A lista "Vistos recentemente" do site fica só no seu navegador e não é enviada à loja. Base legal: Legítimo interesse (art. 7º, IX), com opção de desligar as notificações.
- Avaliações de produtos: nota, texto e o seu nome. Para quê: Publicar a avaliação na página do produto. Publicamente aparece só o primeiro nome e a inicial do último sobrenome (ex.: "Maria S."). Só quem comprou o produto pode avaliar. Base legal: Consentimento (art. 7º, I), ao enviar a avaliação.
- Favoritos, carrinho e cupons usados. Para quê: Guardar sua lista de salvos e o carrinho entre visitas e aplicar descontos. Base legal: Execução de contrato (art. 7º, V).
- Mensagens do assistente de chat do site. Para quê: Responder dúvidas sobre produtos, frete e pedidos. A conversa fica no seu navegador (sessão) e não é salva no banco da loja. Para gerar a resposta, o texto pode ser enviado ao provedor de inteligência artificial (OpenAI). Não escreva CPF, senha ou dados de cartão no chat. Base legal: Legítimo interesse (art. 7º, IX), no atendimento que você mesmo pediu.
- Registros técnicos: endereço IP, data e hora, páginas e chamadas da API, identificador da requisição e relatórios de erro do navegador. Para quê: Segurança (por exemplo, limitar tentativas de login e redefinição de senha), diagnóstico de falhas e prevenção de abuso. Não usamos esses registros para publicidade. Base legal: Legítimo interesse (art. 7º, IX).

Cookies e armazenamento no aparelho
- sch_access e sch_refresh: cookies de sessão (HttpOnly) que mantêm você logado. O de refresh vale até 30 dias e é revogado quando você sai da conta.
- sch_push_device: no app Android, guarda o código interno do aparelho para registrar produtos vistos. Não contém o token de notificação nem sua senha.
- Armazenamento local do navegador: seu nome e e-mail para a interface (sem senha e sem token), o carrinho de visitante, a lista de produtos vistos recentemente e a conversa do chat na sessão. Esses dados ficam no seu aparelho; você pode apagá-los limpando os dados do navegador ou do app.
- Hoje a loja não usa cookies de publicidade nem ferramentas de análise de terceiros (como Google Analytics ou Meta Pixel). Se isso mudar, esta política será atualizada antes.

Com quem compartilhamos (operadores)
Não vendemos nem alugamos seus dados. Compartilhamos apenas o necessário com empresas que prestam serviço para a loja (operadores), cada uma com a própria política de privacidade:
- Mercado Pago: processa PIX e cartão. Recebe valor, descrição do pedido, seu e-mail e os dados digitados no formulário de pagamento.
- Melhor Envio: cota o frete. Recebe o CEP de origem, o CEP de destino e as medidas e o peso dos pacotes (não recebe seu nome).
- Resend: envia os e-mails da loja (pedido recebido, pago, enviado, redefinição de senha). Recebe seu e-mail, seu nome e o conteúdo da mensagem.
- Google Firebase Cloud Messaging: entrega as notificações do app Android. Recebe o token de notificação do aparelho e o texto da notificação.
- OpenAI: gera as respostas do assistente de chat do site. Recebe o texto da conversa.
- Railway: hospeda o site, a API e o banco de dados onde ficam conta, pedidos e registros.
- WhatsApp (Meta): só quando você ou a loja abre uma conversa pelo link do WhatsApp. A mensagem é enviada por pessoas, não por um robô da loja.
- Autoridades: quando a lei ou uma ordem judicial exigir.

Transferência internacional
Alguns operadores (Railway, Resend, Google Firebase e OpenAI) processam dados em servidores fora do Brasil, principalmente nos Estados Unidos. Essa transferência é necessária para prestar o serviço que você contratou e segue as garantias contratuais desses fornecedores (art. 33 da LGPD).

Por quanto tempo guardamos
- Conta, endereços, favoritos, notificações e produtos vistos: enquanto a conta existir. Quando você pede a exclusão da conta, esses dados são apagados ou anonimizados (veja "Excluir sua conta").
- Pedidos, pagamentos, estornos e registros financeiros: 5 anos depois da compra, para cumprir obrigações legais, fiscais e de defesa do consumidor e para responder a contestações. Depois disso podem ser apagados ou anonimizados.
- Sessões: o cookie de refresh expira em até 30 dias; links de redefinição de senha expiram em 1 hora.
- Produtos vistos no app (e o registro dos lembretes enviados): apagados automaticamente 90 dias depois da última visualização, ou antes, se você pedir a exclusão da conta.
- Token de notificação: enquanto o aparelho estiver registrado. O token é desativado quando o Firebase informa que ele deixou de valer (por exemplo, depois de desinstalar o app) e é apagado quando você pede a exclusão da conta ou pelos canais abaixo.
- Registros técnicos (logs com IP, data e hora): ficam só no painel do provedor de hospedagem (Railway) e são apagados automaticamente por ele no prazo do plano contratado (7 dias no plano Hobby, 30 dias no Pro). A loja não exporta nem guarda cópia própria desses registros.

Seus direitos (art. 18 da LGPD)
Para exercer qualquer direito, use os canais abaixo. Podemos pedir a confirmação de identidade (por exemplo, que a mensagem venha do e-mail ou telefone cadastrado) para proteger sua conta. Respondemos em até 15 dias.
- Confirmar se tratamos seus dados e acessar uma cópia deles.
- Corrigir dados incompletos ou errados. Nome e telefone podem ser alterados em Minha conta → Dados pessoais.
- Pedir anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desacordo com a LGPD.
- Portabilidade dos dados a outro fornecedor.
- Saber com quem compartilhamos seus dados.
- Revogar o consentimento (por exemplo, desligar as notificações) e se opor a tratamentos baseados em legítimo interesse.
- Pedir a exclusão da conta: veja a página Excluir conta.
- Reclamar à Autoridade Nacional de Proteção de Dados (ANPD), em gov.br/anpd.

Segurança
- Conexão sempre criptografada (HTTPS). O app Android bloqueia conexões sem criptografia.
- Senhas guardadas só como hash; os tokens de sessão ficam em cookies HttpOnly, fora do alcance de scripts.
- Limite de tentativas de login e de redefinição de senha.
- Acesso ao painel da loja restrito à equipe, com registro de auditoria das operações financeiras.

Menores de idade
A loja não é direcionada a crianças e adolescentes. O cadastro exige 18 anos ou mais.

Alterações desta política
Se mudarmos o que coletamos ou com quem compartilhamos (por exemplo, um novo meio de pagamento ou ferramenta de análise), atualizamos esta página e a data no topo antes da mudança.

Excluir sua conta: https://lojasschimitz.com.br/excluir-conta
```

## 4. Texto em produção: Excluir conta (listas da página)

```
Passos:
1. Entre na sua conta no site lojasschimitz.com.br ou no app Android da Lojas Schimitz.
2. Abra esta página (Minha conta → Ajuda → Excluir conta, ou o link "Excluir conta" no rodapé).
3. Marque a confirmação e toque em "Pedir exclusão da conta". Se quiser, conte o motivo.
4. A loja processa o pedido em até 15 dias. Enquanto não for processado, você pode desistir nesta mesma página.

O que é apagado:
- Nome, e-mail, telefone/WhatsApp, CPF e data de nascimento (a conta é anonimizada e não pode mais entrar).
- Senha e todas as sessões abertas (você sai de todos os aparelhos).
- Endereços salvos, favoritos (Salvos) e carrinho.
- Notificações da conta, token de notificação do app e produtos vistos registrados para notificações.
- Avaliações de produtos que você publicou (a nota média do produto é recalculada).

O que fica guardado:
- Pedidos, pagamentos, estornos e o endereço de entrega usado em cada pedido: guardados por 5 anos depois da compra para cumprir obrigações legais, fiscais e de defesa do consumidor (art. 16 da LGPD). Ficam ligados a uma conta anonimizada.
- Histórico de cashback (SCHIMITZ+) e registros de auditoria das operações financeiras, pelo mesmo prazo. Saldo de cashback não usado é perdido com a exclusão.
- Registros técnicos de acesso (IP, data e hora): não ficam no banco da loja; o provedor de hospedagem (Railway) apaga automaticamente no prazo do plano (7 a 30 dias).

Observações:
- Se houver pedido em andamento (aguardando pagamento, pago, em separação ou a caminho), a exclusão é feita depois que ele for entregue ou cancelado.
- Desinstalar o app não exclui a conta. Dados guardados só no seu aparelho (carrinho de visitante, produtos vistos recentemente, conversa do chat) são apagados limpando os dados do navegador ou do app.
- Contas da equipe da loja (admin ou vendedor) não usam este fluxo: fale pelo WhatsApp.
```
