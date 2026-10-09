# Queda curta da API a cada deploy: causa, plano e risco

Investigação de 09/10/2026, só leitura (Railway MCP + documentação oficial do Railway).

## O que foi medido
- Nos logs HTTP do Railway houve **5 respostas 502** entre 17:00:30 e 17:00:31 UTC (`/health/payments`, `/products`, `/store/settings`, `/store/shelves`), cada uma esperando 15 s pelo proxy. Foi exatamente a troca de versão do deploy do #190.
- Os demais deploys do dia não deixaram 502 nos logs HTTP daquele intervalo; o efeito é curto (segundos), mas acontece quando alguém está navegando.
- Inicialização da API (deploy 80b65ac6): "Starting Container" 17:10:17.44 → "Nest application successfully started" 17:10:18.33. Ou seja, **o processo sobe em ~1 s**. As migrações rodam em ~0 s ("No pending migrations to apply").

## Causa (confirmada pela documentação)
O serviço da API tem um **volume** anexado (`/data/uploads`). A documentação do Railway diz: *"services with an attached volume cannot run two deployments at once, so a redeploy of a volume-backed service always has a small window of downtime"* (guias "Rotate credentials without downtime" e "Deploy on merge"), **mesmo com healthcheck configurado**.

Por isso:
- `healthcheckPath = /api/v1/health` (já existe, é rápido e não usa banco) e `healthcheckTimeout = 30` **estão certos** e não resolvem o problema.
- `RAILWAY_DEPLOYMENT_OVERLAP_SECONDS` (sobrepor versão nova e antiga) **não funciona** com volume, porque as duas versões não podem coexistir.
- `RAILWAY_DEPLOYMENT_DRAINING_SECONDS` (tempo de SIGTERM→SIGKILL) só ajuda a terminar requisições em andamento; a API já trata SIGTERM nas métricas financeiras e sobe em 1 s. Ganho pequeno, e mexer em shutdown hooks do Nest junto com o tratador de SIGTERM existente (teste M06) tem risco de mudar o comportamento de saída. **Não fiz PR de código para isso**: nada no código elimina a janela enquanto houver volume.

## O que usa o volume
- Só os **uploads do admin**: `UPLOADS_DIR=/data/uploads`, servidos em `/api/v1/uploads/<uuid>.<ext>` (`uploads.service.ts` e `main.ts`).
- Hoje, em produção público: **os 100 produtos não têm foto**; só **4 banners** da home apontam para `/api/v1/uploads/...jpg`. Backups e banco ficam em outros serviços.

## Plano (precisa de aprovação, mexe em infraestrutura)
1. **Código (PR, sem mudar produção até ligar):** trocar o armazenamento de uploads por um adaptador de bucket (Railway Bucket, compatível com S3) atrás de uma flag, mantendo a URL pública `/api/v1/uploads/<arquivo>` (a API redireciona/stream do bucket), com teste usando um bucket falso.
2. **Infra (Hector aprova):** criar o bucket no Railway e as variáveis de acesso na API (nomes só na hora, sem expor valores).
3. **Migração:** copiar os 4 arquivos atuais do volume para o bucket (leitura do volume + upload), conferir que as 4 URLs dos banners continuam 200.
4. **Cortar:** ligar a flag, conferir uploads novos no admin, e só então **desanexar o volume** do serviço da API. A partir daí os deploys passam a ter sobreposição (overlap) e zero queda; aí vale definir `RAILWAY_DEPLOYMENT_OVERLAP_SECONDS` (ex.: 20).
5. **Rollback:** reanexar o volume e desligar a flag; os arquivos antigos continuam no volume até você mandar apagar.

## Risco
- Médio: mexe no caminho de upload e na infra. Cuidados: nenhum arquivo é apagado, a flag começa desligada, as 4 URLs públicas dos banners não mudam.
- Alternativa de custo zero: aceitar a queda de ~segundos por deploy e **evitar deploys da API em horário de pico** (os deploys só de web não derrubam a API, e PRs só de docs são SKIPPED).
- Enquanto a migração não acontece: nada a fazer no Railway.
