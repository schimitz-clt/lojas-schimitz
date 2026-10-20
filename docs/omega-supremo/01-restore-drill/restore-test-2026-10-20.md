# Teste mensal de restauração — 2026-10-20

**Resultado: PASSOU ✅** — 49/49 tabelas, 8 968/8 968 linhas iguais ao manifest do backup.

(Tentativa anterior às ~13:30 UTC bloqueada por falta da chave age; o Hector forneceu a chave via variável de ambiente e o drill foi refeito às 14:27 UTC.)

## Backup testado
- Objeto: `postgres/daily/2026-10-20_20261020T061856Z.dump.age` (createdAt 2026-10-20T06:18:57Z, PG server/pg_dump 18.6, `pg_dump -Fc -Z6 | age`)
- Bucket: 7 dumps diários presentes (14/10 a 20/10), retenção OK
- encSha256 `124bb520…1a3d08` (852 442 B) = log `BACKUP_OK` = manifest → **ENC_OK**
- plainSha256 `63a87dd8…915ce` (852 034 B) = log = manifest → **PLAIN_OK**

## Restauração (procedimento de docs/BACKUP_RESTORE.md §2)
- Ambiente: PostgreSQL 18 local descartável no box (initdb em /tmp, só socket Unix, porta 55432, sem rede)
- `pg_restore --no-owner --no-acl --exit-on-error` → sem erros, 234 ms
- 35 migrações Prisma no banco restaurado
- Contagens comparadas com o `rowCounts` do manifest (sem acesso de leitura direto à produção; produção não foi consultada)
- Linha do tempo (UTC): download 14:27:39 → restauração/contagem → limpeza 14:27:42

## Contagens por tabela (restaurado = manifest)
| Tabela | Linhas |
|---|---|
| AbandonedViewPush | 22 |
| Address | 18 |
| AuditLog | 412 |
| Cart | 4042 |
| CartItem | 39 |
| CashbackLedger | 25 |
| Category | 12 |
| Chargeback | 0 |
| CommissionLedger | 23 |
| Coupon | 1 |
| DeviceFcmToken | 97 |
| Favorite | 1 |
| FinanceMetricCounter | 31 |
| FinancialAuditEvent | 30 |
| FinancialDiscrepancy | 4 |
| FinancialLedgerEntry | 90 |
| FinancialReconciliationRun | 4 |
| HomeBanner | 7 |
| IdempotencyRecord | 108 |
| Inventory | 112 |
| InventoryMovement | 36 |
| Notification | 226 |
| Order | 63 |
| OrderItem | 65 |
| OrderStatusHistory | 229 |
| PasswordResetToken | 13 |
| Payment | 42 |
| PaymentEvent | 87 |
| PaymentReconciliation | 2 |
| PaymentRefund | 1 |
| PaymentStateTransition | 87 |
| Product | 112 |
| ProductImage | 8 |
| ProductSupplier | 0 |
| ProductViewEvent | 28 |
| PushCampaign | 28 |
| PushDispatch | 2238 |
| RefreshToken | 540 |
| Review | 0 |
| RevokedAccessToken | 0 |
| RiskAssessment | 7 |
| SchedulerLock | 0 |
| Seller | 2 |
| SellerMpCredential | 1 |
| ShippingCepRule | 2 |
| ShippingSettings | 1 |
| StoreSettings | 1 |
| User | 36 |
| _prisma_migrations | 35 |

## Segurança e limpeza
- Nenhuma escrita/conexão aos bancos de produção ou staging.
- Credenciais do bucket e chave age usadas só via variáveis de ambiente; nada impresso nem gravado em logs/relatório.
- Arquivo temporário da chave (chmod 600) apagado com `shred -u` logo após descriptografar.
- `db.dump.age` e `db.dump` apagados com `shred -u`; cluster Postgres parado e diretório removido.
- Nenhuma cópia persistente da chave criada pelo drill (chave mantida apenas no cofre de segredos do operador, fora do repositório).
