# Segurança — SCH-001

- Senhas: argon2id
- Tokens: JWT access curto + refresh persistido com hash
- Secrets somente em `.env` (não versionado)
- CORS allowlist
- Validação de entrada (class-validator)
- Filter global: nunca devolver stack em produção
- Rate limit (Throttler)
- Helmet
- Roles: customer / admin (seller reservado)
- Logs com request-id; sem senha/token
- HTTPS obrigatório em staging e production
