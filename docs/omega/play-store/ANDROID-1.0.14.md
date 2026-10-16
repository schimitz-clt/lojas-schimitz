# Android 1.0.14 (versionCode 15): conferência de 16/10/2026

## Conferido no build `/workspace/android-build` (commit 6d9192c, PR #215)
- AAB: `apps/mobile/app/build/outputs/bundle/release/app-release.aab` (4,67 MB, gerado em 15/10 às 23:52). **Sem assinatura**, aguardando a chave nova de upload aprovada pelo Google.
- Manifesto final do release: `versionCode="15"`, `versionName="1.0.14"`, minSdk 24, targetSdk 36.
- Permissões: INTERNET, ACCESS_NETWORK_STATE, POST_NOTIFICATIONS, WAKE_LOCK e c2dm.RECEIVE (FCM), mais a permissão interna DYNAMIC_RECEIVER_NOT_EXPORTED (AndroidX). Sem localização, câmera, microfone, contatos ou arquivos.
- `usesCleartextTraffic=false`. `isMinifyEnabled=false`, como nas versões anteriores.
- Achado, **não alterado**: `allowBackup="true"`, sem `dataExtractionRules`. O backup do Android pode copiar dados do WebView, incluindo cookies de sessão. Mudar isso exige gerar outro AAB. Fica como recomendação para a 1.0.15, ou para antes de assinar, se o Hector preferir.
- Os PRs #216, #217, #219, #221 e #222 só mudaram o servidor e o site. O app abre o site, então recebe essas mudanças sem precisar de um build novo.
- GA4 e Meta Pixel continuam **desligados** em produção (o HTML da home de 16/10 não tem `gtag`, `fbq` nem `googletagmanager`). A Segurança dos dados de `ficha.md` §4 continua valendo.

## Notas da versão (pt-BR, até 500 caracteres)
> Navegação mais fluida e abertura mais rápida. Melhorias de segurança na sessão: ao sair da conta, o acesso é encerrado na hora. Correções gerais de estabilidade.

## Checklist "Segurança dos dados" (Play Console)
1. Coleta ou compartilha dados? **Sim.**
2. Criptografados em trânsito? **Sim.**
3. Exclusão de conta: **Sim**, https://lojasschimitz.com.br/excluir-conta
4. Marque os tipos de `ficha.md` §4: nome, e-mail, IDs do usuário, endereço, telefone (opcional), outras informações (CPF e nascimento), pagamento (efêmero), histórico de compras, mensagens no app, interações, conteúdo do usuário (avaliações), falhas/diagnóstico e IDs do dispositivo (FCM).
5. Compartilhado com terceiros: **Não** em todos (prestadores de serviço não contam como compartilhamento).
6. Localização, fotos, áudio, contatos e saúde: **Não**.

## Motivo da recusa em produção
**Desconhecido.** Não tenho acesso ao Play Console. O Hector precisa abrir Play Console → Visão geral da publicação (ou o e-mail do Google) e copiar o texto da recusa.
