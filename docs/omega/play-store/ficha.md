# Ficha da Play Store — Lojas Schimitz (com.lojasschimitz.app)

Rascunho preparado em 09/10/2026, com base no código do repositório (`apps/mobile`, `apps/web`, `apps/api`) e na página pública https://lojasschimitz.com.br/privacidade.
Itens marcados **PENDENTE DO HECTOR** precisam de dado ou decisão do dono. Nada foi preenchido no Play Console: este arquivo é só para copiar e colar.

---

## 1. Detalhes do app

| Campo | Limite | Texto proposto | Tamanho |
|---|---|---|---|
| Nome do app | 30 | `Lojas Schimitz` | 14 |
| (alternativa) | 30 | `Lojas Schimitz: Eletro e Casa` | 29 |
| Descrição curta | 80 | `Eletro, celulares e casa em POA. PIX com desconto e frete grátis na capital.` | 76 |

> A Google proíbe no nome palavras como "grátis", "promoção" ou "nº 1" e preços. Por isso o nome fica só com a marca. Na descrição curta, "frete grátis" é aceito por ser uma condição real da loja. Se preferir evitar, use: `Eletro, celulares e casa em Porto Alegre, com PIX e entrega rápida.` (67).

### Descrição completa (≤ 4000; atual: 1623 caracteres)

```
A Lojas Schimitz agora está no seu celular. Compre eletro, celulares, informática, casa, esporte e muito mais com a mesma segurança do nosso site, em uma loja de Porto Alegre que entrega na sua porta.

POR QUE COMPRAR PELO APP
• PIX com desconto: pague no PIX e ganhe 5% de desconto na hora.
• Parcele no cartão em até 3x (juros conforme o Mercado Pago), com pagamento processado pelo Mercado Pago.
• Frete grátis em Porto Alegre, de acordo com as condições da loja. Para outras cidades, informe o CEP e veja o prazo e o valor antes de fechar o pedido.
• Ofertas e cupons: acompanhe as promoções da semana e os cupons ativos.
• Notificações (opcionais): avisos de ofertas e novidades. Você pode desligar quando quiser nas configurações do Android.

FAÇA TUDO NA PALMA DA MÃO
• Busque produtos por nome ou categoria, filtre e ordene os resultados.
• Veja fotos, descrição, disponibilidade e avaliações de quem já comprou.
• Salve seus favoritos e compare produtos.
• Acompanhe seus pedidos: pago, separado, enviado e entregue.
• Fale com a loja pelo WhatsApp com um toque.

COMPRA SEGURA
• Conexão sempre criptografada (HTTPS).
• Os dados do cartão ficam com o Mercado Pago; a loja não guarda o número do cartão.
• Sua senha é armazenada com criptografia (hash) e nunca em texto puro.

SOBRE A LOJA
A Lojas Schimitz é uma loja de Porto Alegre (RS) focada em eletro, celulares e casa, com atendimento direto pelo WhatsApp. O app abre a loja oficial lojasschimitz.com.br, com o mesmo catálogo, os mesmos preços e a mesma conta do site.

Dúvidas, trocas e privacidade: fale com a gente pelo WhatsApp. Para excluir sua conta: lojasschimitz.com.br/excluir-conta.
```

> **PENDENTE DO HECTOR:** confirme as condições comerciais que a descrição cita (PIX 5%, parcelamento em até 3x no cartão, frete grátis em POA, trocas). Elas foram copiadas da faixa da home em 09/10/2026. Se mudarem, a ficha precisa mudar junto, porque a Google pune descrição enganosa.

### Notas da versão (≤ 500; atual: 311) · versão 1.0.12 · versionCode 13

```
Primeira versão pública da Lojas Schimitz:
• Loja completa: busca, categorias, ofertas, favoritos e carrinho.
• Pagamento por PIX (com desconto) ou cartão em até 3x, via Mercado Pago.
• Acompanhamento de pedidos e atendimento pelo WhatsApp.
• Notificações opcionais de ofertas.
• Nova identidade visual e ícone.
```

## 2. Categoria e contato

| Campo | Proposta |
|---|---|
| Tipo | App |
| Categoria | **Compras** |
| Tags sugeridas | Compras, Eletrônicos, Casa |
| E-mail de contato (obrigatório e público) | **PENDENTE DO HECTOR**. A /privacidade nova (PR #186) não tem mais e-mail fixo; ele aparece só se você definir `NEXT_PUBLIC_STORE_PRIVACY_EMAIL` no serviço web. Use o mesmo e-mail aqui. |
| Telefone (opcional e público) | **PENDENTE DO HECTOR** (a /privacidade cita o WhatsApp da loja; decida se quer expor na Play) |
| Site | https://lojasschimitz.com.br |
| Política de privacidade (URL) | https://lojasschimitz.com.br/privacidade (PR #186 mesclado e no ar desde 09/10/2026; ver `PRIVACIDADE-PARA-REVISAO.md`) |
| Exclusão de conta (URL, exigida em Segurança dos dados) | https://lojasschimitz.com.br/excluir-conta (PR #187 mesclado; no ar e respondendo 200 desde 09/10/2026) |
| Endereço físico / CNPJ | **PENDENTE DO HECTOR**. A /privacidade nova não afirma mais "pessoa física" e só mostra razão social, CNPJ e endereço se você definir `NEXT_PUBLIC_STORE_LEGAL_NAME`, `NEXT_PUBLIC_STORE_CNPJ` e `NEXT_PUBLIC_STORE_ADDRESS`. Se a conta de desenvolvedor for de organização, a Google exige os dados da empresa (D-U-N-S). |

## 3. Imagens exigidas pela Google (Ficha principal)

| Recurso | Exigência da Google | Status / arquivo |
|---|---|---|
| Ícone do app | PNG 32 bits (com alfa), **512 × 512 px**, até 1 MB | ✅ `icone-512.png` (cópia de `apps/mobile/store/icon-512.png`, 512×512 RGBA, 15 KB) |
| Gráfico de recursos (feature graphic) | JPEG ou PNG 24 bits (sem alfa), **1024 × 500 px**, até 15 MB | 🟡 `feature-graphic-1024x500-RASCUNHO.png` (gerado com a logo N5 e textos da home; revise o texto) |
| Capturas de tela de celular | **mín. 2, máx. 8**; JPEG ou PNG 24 bits; cada lado entre 320 e 3840 px; o lado maior pode ser no máximo 2× o menor. Para entrar nas recomendações: pelo menos 4 capturas com no mínimo 1080 px | 🟡 `capturas/01-home.png` … `06-carrinho.png` (1080 × 1920, 9:16, da loja pública de produção) |
| Capturas de tablet 7" e 10" | Opcionais (recomendadas se o app aparecer para tablets) | Não geradas |
| Vídeo (YouTube) | Opcional | — |

Sobre as capturas:
- Foram geradas pelo navegador headless em tamanho de celular (360×640 com densidade 3 = 1080×1920), com o mesmo User-Agent do app, na loja **pública** de produção, sem login.
- **Atenção:** hoje **nenhum produto tem foto** (a API devolve `images: []`), então os cards e a página de produto mostram "Foto em preparação". **Recomendado (PENDENTE DO HECTOR):** subir fotos reais de pelo menos alguns produtos e gerar as capturas de novo, porque capturas com placeholders reduzem a conversão. Basta rodar o script de novo (ver `README-capturas.md`).
- Capturas do emulador (moldura do app): ver seção do relatório. Ficam em `capturas-emulador/` quando disponíveis.

## 4. Segurança dos dados (Data safety): rascunho de respostas

Base: o app é um WebView que abre `https://lojasschimitz.com.br`. Tudo que o site coleta conta como coletado pelo app. Verificado no código em 09/10/2026:
- **Cadastro** (`RegisterDto`): nome completo, e-mail, senha, **CPF (obrigatório)**, **data de nascimento (obrigatória, 18+)** e telefone/WhatsApp (opcional).
- **Endereços:** CEP, rua, número, complemento, bairro, cidade e UF.
- **Pedidos e pagamentos:** histórico, método e status. O cartão é tokenizado pelo Mercado Pago.
- **Push FCM** (`PushRegistration.kt`): token FCM, plataforma, versão do app e um `deviceId` gerado pela API (cookie `sch_push_device`).
- **Visualizações de produto** (`ProductViewEvent`), ligadas ao device, para o lembrete de "viu e não comprou".
- **UTM** da campanha no pedido.
- **Chat** do assistente do site.
- **Avaliações** de produto.
- **Relatórios de erro do cliente** (`/api/v1/security/client-error`).
- **Logs técnicos:** IP e request id.
- **Não há localização por GPS:** o site bloqueia via `Permissions-Policy geolocation=()` e o app não pede permissão de localização.
- **Não há câmera ou microfone.** O seletor de arquivos é usado só no Admin.
- **GA4 e Meta Pixel** existem no código, mas **estão desligados em produção** (verificado no HTML da home em 09/10/2026). Se forem ligados, esta seção tem de mudar.

### Perguntas gerais
| Pergunta | Resposta proposta |
|---|---|
| O app coleta ou compartilha algum dos tipos de dados exigidos? | **Sim** |
| Os dados são criptografados em trânsito? | **Sim** (HTTPS obrigatório; cleartext bloqueado no app) |
| Você oferece uma forma de os usuários pedirem a exclusão dos dados? | **Sim.** Link da web: **https://lojasschimitz.com.br/excluir-conta** (PR #187). O cliente logado pede no site/app (ou pelo WhatsApp, se não consegue entrar); a loja processa em até 15 dias no Admin → Clientes. Apaga endereços, favoritos, carrinho, notificações, sessões, token de push, produtos vistos e avaliações, e anonimiza nome, e-mail, telefone, CPF e nascimento. **Mantém** pedidos, pagamentos, cashback e auditoria por 5 anos (obrigação legal). No Console: marcar "Os usuários podem pedir a exclusão da conta" e também a exclusão parcial de dados **Não** (o fluxo é da conta inteira). |

### Tipos de dados (coletados; compartilhados = Não, salvo nota)
"Compartilhamento", na definição da Google, **não inclui** prestadores de serviço que processam dados em nome da loja (Mercado Pago, hospedagem, Firebase). Por isso a proposta é "não compartilhado" em todos os itens.

| Categoria Google | Tipo | Coletado? | Obrigatório? | Finalidades |
|---|---|---|---|---|
| Informações pessoais | Nome | Sim | Obrigatório para comprar | Funcionalidade do app, Gerenciamento da conta |
| Informações pessoais | Endereço de e-mail | Sim | Obrigatório para comprar | Funcionalidade, Gerenciamento da conta, Comunicações (avisos de pedido) |
| Informações pessoais | IDs do usuário | Sim (id da conta) | Obrigatório para comprar | Funcionalidade, Gerenciamento da conta |
| Informações pessoais | Endereço | Sim | Obrigatório para entrega | Funcionalidade |
| Informações pessoais | Número de telefone | Sim | **Opcional** | Funcionalidade (atendimento WhatsApp) |
| Informações pessoais | Outras informações | Sim (CPF e data de nascimento) | Obrigatório para cadastro | Funcionalidade, Prevenção de fraude/segurança/conformidade |
| Informações financeiras | Informações de pagamento do usuário | **Sim**, com cautela: o cartão é digitado na página e enviado ao Mercado Pago, que tokeniza. A loja não guarda o número. Declarar como coletado e **efêmero** se o Console oferecer | Obrigatório para pagar com cartão | Funcionalidade, Prevenção de fraude |
| Informações financeiras | Histórico de compras | Sim | Obrigatório | Funcionalidade, Análise (relatórios de vendas da loja) |
| Mensagens | Outras mensagens no app | Sim (chat do assistente) | Opcional | Funcionalidade, Suporte |
| Atividade no app | Interações no app | Sim (produtos vistos, favoritos) | Opcional | Funcionalidade, Marketing do próprio app (lembrete por push) |
| Atividade no app | Histórico de pesquisa no app | **Verificar.** Não encontrei gravação de buscas por usuário; a busca é só consulta. Proposta: **Não** | — | — |
| Atividade no app | Outro conteúdo gerado pelo usuário | Sim (avaliações de produto) | Opcional | Funcionalidade |
| Informações e desempenho do app | Registros de falhas / Diagnóstico | Sim (erros do cliente e logs técnicos com IP) | Automático | Análise, Prevenção de fraude/segurança |
| IDs do dispositivo ou outros | IDs do dispositivo ou outros | Sim (token FCM e deviceId da loja) | Opcional (só com notificações) | Funcionalidade (push), Marketing do próprio app |
| Localização | Aproximada / Precisa | **Não** (o CEP já está em "Endereço") | — | — |
| Fotos, vídeos, áudio, arquivos, contatos, agenda, saúde | — | **Não** (o upload de fotos é só no Admin, por funcionários) | — | — |

> **/privacidade atualizada no PR #186 (mesclado e no ar em 09/10/2026).** O texto novo corrige "Trusted Web Activity" (agora: app nativo com WebView) e passa a citar CPF, data de nascimento, endereços, pedidos e pagamentos (Mercado Pago), token FCM e deviceId, produtos vistos, avaliações, chat (OpenAI), e-mails (Resend), frete (Melhor Envio: só CEP e pacote), logs com IP, cookies, bases legais, operadores, transferência internacional, retenção, direitos e o link para /excluir-conta. Texto completo e lista do que confirmar: `PRIVACIDADE-PARA-REVISAO.md`. Revisões depois disso, também no ar: #188 (logs só no Railway, pelo prazo do plano), #189 (produtos vistos apagados após 90 dias), #190 (avaliação pública mostra só "Maria S.") e #194 (no Android 12 ou anterior, a partir da 1.0.13 o app pede consentimento antes de enviar o token de notificação).

## 5. Classificação de conteúdo (questionário IARC): rascunho

| Pergunta | Resposta proposta |
|---|---|
| Categoria do app | **Todos os outros tipos de app** (loja / compras; não é jogo, rede social nem referência) |
| Violência, medo, sexualidade, nudez, linguagem imprópria | Não |
| Drogas, álcool, tabaco | **PENDENTE DO HECTOR**: o catálogo vende bebidas alcoólicas ou tabaco/vape? Hoje não vi produtos assim. Se vender, responda Sim |
| Jogos de azar / simulados | Não |
| Usuários interagem ou trocam conteúdo? | **Sim**: avaliações públicas de produtos (texto). Não há chat entre usuários; o chat é com o assistente/loja |
| Compartilha localização do usuário com outros usuários? | Não |
| Permite comprar produtos digitais? | Não (só produtos físicos) |
| Contém conteúdo gerado pelo usuário sem moderação? | **PENDENTE DO HECTOR**: as avaliações passam por moderação no Admin? Existe a exclusão de avaliação no Admin, então a resposta é "moderação depois da publicação" |
| Resultado esperado | Classificação baixa (Livre / PEGI 3 / ESRB Everyone), possivelmente com o descritor "Os usuários interagem" |

## 6. Público-alvo e conteúdo

| Pergunta | Resposta proposta |
|---|---|
| Faixa etária do público-alvo | **18 anos ou mais** (o cadastro exige 18+; a /privacidade diz "não é direcionada a crianças") |
| O app pode atrair crianças sem querer? | Não (loja de eletro, celulares e casa; sem personagens nem jogos) |
| Anúncios | **Não contém anúncios** (não há SDK de anúncios; GA4/Pixel desligados) |
| Acesso ao app (para o revisor) | Navegação livre sem login. **Login é exigido para comprar.** Proposta: "Algumas funcionalidades são restritas". **PENDENTE DO HECTOR:** criar uma conta de teste para o revisor da Google (e-mail e senha só no Console, nunca neste repositório) e instruir: "Não finalize pagamento; PIX gera cobrança real". Não criei conta em produção. |
| App de notícias / governo / saúde / recursos financeiros / VPN | Não / Não / Não / Não (o pagamento é por processador terceiro, o app não é instituição financeira) / Não |
| Permissões sensíveis | Só `POST_NOTIFICATIONS` (runtime). Nada de localização, contatos, SMS, armazenamento amplo ou câmera |
| ID de publicidade | **Não usa.** Confirmar no Console que o app **não** declara `AD_ID`; o manifest atual não tem `com.google.android.gms.permission.AD_ID`. O Firebase Messaging não exige |

## 7. Checklist de envio (em ordem)
1. ⏳ Acesso à produção (pedido em análise na Google, até 7 dias).
2. **PENDENTE DO HECTOR:**
   - e-mail e telefone de contato;
   - ✅ PRs #186 e #187 mesclados e no ar (09/10/2026); continuam valendo as confirmações de `PRIVACIDADE-PARA-REVISAO.md`;
   - definir, se quiser, `NEXT_PUBLIC_STORE_PRIVACY_EMAIL` / `NEXT_PUBLIC_STORE_CNPJ` / `NEXT_PUBLIC_STORE_ADDRESS` / `NEXT_PUBLIC_STORE_LEGAL_NAME` no serviço web (exige novo build);
   - conta de teste para o revisor;
   - fotos dos produtos e, depois, regerar as capturas;
   - aprovar o feature graphic.
3. Gerar o AAB assinado de release (ver `RELEASE.md`) e subir na faixa de Produção (ou primeiro na faixa fechada já existente).
4. Preencher Segurança dos dados, Classificação, Público-alvo, Anúncios e Acesso ao app com as respostas acima.
5. Revisar e enviar para análise.
