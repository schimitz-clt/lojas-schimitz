import { CallHandler, ExecutionContext, Inject, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from './audit.service';
import { buildAdminAuditRecord } from './admin-audit';

/**
 * Registra em AuditLog toda ação administrativa que altera dados (POST/PUT/PATCH/DELETE):
 * quem (actorId), o quê (rota + corpo saneado), resultado (ok/erro) e quando.
 * Nunca bloqueia nem altera a resposta: falha de auditoria é engolida pelo AuditService.
 */
@Injectable()
export class AdminAuditInterceptor implements NestInterceptor {
  constructor(@Inject(AuditService) private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const req = context.switchToHttp().getRequest();
    const write = (outcome: { ok: true } | { ok: false; status: number }) => {
      try {
        const rec = buildAdminAuditRecord(req, outcome);
        if (!rec) return;
        void this.audit
          .log(rec.action, { actorId: rec.actorId, entity: rec.entity, entityId: rec.entityId, meta: rec.meta })
          .catch(() => undefined);
      } catch {
        /* auditoria nunca derruba a requisição */
      }
    };
    return next.handle().pipe(
      tap({
        next: () => write({ ok: true }),
        error: (e: any) => write({ ok: false, status: Number(e?.status ?? e?.getStatus?.() ?? 500) }),
      }),
    );
  }
}
