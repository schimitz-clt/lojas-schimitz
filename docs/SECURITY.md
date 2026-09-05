# Segurança — SCH-001

- Senhas: argon2id
- Tokens: JWT access curto + refresh persistido com hash
- Secrets somente em `.env` (não versionado)
- CORS allowlist
- Validação de entrada (class-validator)
- Filter global: nunca devolver stack em produção
- Rate limit (Throttler) global + por rota (ex.: chat 20/min)
- Brute-force em `/auth/login` e `/auth/register`: além do Throttler (8 req/min),
  contador de **falhas** por IP e por e-mail — 5 em 15 minutos → HTTP 429
  (`RATE_LIMITED`, mensagem em PT-BR). Login/cadastro bem-sucedido zera o contador.
  Janela deslizante (sem bloqueio permanente). Em memória no processo da API (v1).
- Helmet
- Roles: customer / admin (seller reservado)
- Multi-admin: qualquer `role=admin` + `status=active` acessa o painel; desativar = `status=blocked` (não apaga). Não desativa a si mesmo nem o último admin ativo. Senhas com argon2 (igual ao login).
- Logs com request-id; sem senha/token
- HTTPS obrigatório em staging e production
