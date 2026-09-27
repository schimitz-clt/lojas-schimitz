/**
 * ============================================================================
 *  TEST ONLY — LOCAL FAKE MERCADO PAGO HTTP SERVER. NOT PRODUCTION. NOT A MOCK
 *  OF PRODUCTION DATA. Binds to 127.0.0.1 only and refuses any bearer token
 *  that does not start with "TEST-FAKE-". Used so the REAL MercadoPago adapter
 *  (HTTP, headers, idempotency keys, error mapping) is exercised without ever
 *  touching api.mercadopago.com or real credentials.
 * ============================================================================
 */
import { createServer, IncomingMessage, Server, ServerResponse } from 'http';
import { AddressInfo } from 'net';

export type FakeMpPayment = {
  id: string;
  status: string;
  status_detail: string | null;
  transaction_amount: number;
  transaction_amount_refunded: number;
  external_reference: string | null;
  payment_method_id: string;
};
export type FakeMpRefund = { id: string; payment_id: string; amount: number; status: string; idem: string };

export class FakeMercadoPagoServer {
  readonly label = 'TEST FAKE MERCADO PAGO (local, not production)';
  private server: Server | null = null;
  baseUrl = '';
  payments = new Map<string, FakeMpPayment>();
  refunds = new Map<string, FakeMpRefund[]>();
  chargebacks = new Map<string, Record<string, unknown>>();
  private idemPayments = new Map<string, string>();
  private idemRefunds = new Map<string, FakeMpRefund>();
  private seq = Date.now() * 1000; // unique across runs (local DB keeps old rows)
  calls: { method: string; path: string; idem?: string; callerId?: string }[] = [];
  /** Failure injection: next N requests matching the predicate respond with `status`. */
  failures: { match: (m: string, p: string) => boolean; status: number; remaining: number }[] = [];
  delayMs = 0;
  /** When set, POST /v1/payments returns this status for card payments. */
  nextCardStatus: { status: string; status_detail: string } = { status: 'approved', status_detail: 'accredited' };
  refundStatus: 'approved' | 'in_process' | 'rejected' = 'approved';

  async start(): Promise<string> {
    this.server = createServer((req, res) => void this.handle(req, res));
    await new Promise<void>((r) => this.server!.listen(0, '127.0.0.1', () => r()));
    const { port } = this.server.address() as AddressInfo;
    this.baseUrl = `http://127.0.0.1:${port}`;
    return this.baseUrl;
  }

  async stop() {
    if (this.server) await new Promise<void>((r) => this.server!.close(() => r()));
    this.server = null;
  }

  reset() {
    this.payments.clear(); this.refunds.clear(); this.chargebacks.clear();
    this.idemPayments.clear(); this.idemRefunds.clear(); this.calls = []; this.failures = [];
    this.delayMs = 0; this.refundStatus = 'approved';
    this.nextCardStatus = { status: 'approved', status_detail: 'accredited' };
  }

  failNext(match: (m: string, p: string) => boolean, status: number, times = 1) {
    this.failures.push({ match, status, remaining: times });
  }

  /** Simulates what MP would do out-of-band (customer paid, dispute, etc.). */
  setPayment(id: string, patch: Partial<FakeMpPayment>) {
    const p = this.payments.get(id);
    if (!p) throw new Error(`fake MP: unknown payment ${id}`);
    Object.assign(p, patch);
  }

  addPayment(p: Partial<FakeMpPayment> & { transaction_amount: number }): FakeMpPayment {
    const id = String(++this.seq);
    const row: FakeMpPayment = {
      id, status: 'pending', status_detail: null, transaction_amount_refunded: 0, external_reference: null, payment_method_id: 'pix', ...p,
    };
    this.payments.set(id, row);
    return row;
  }

  count(method: string, pathRe: RegExp) {
    return this.calls.filter((c) => c.method === method && pathRe.test(c.path)).length;
  }

  private send(res: ServerResponse, status: number, body: unknown) {
    res.writeHead(status, { 'content-type': 'application/json', 'x-fake-provider': 'TEST-LOCAL-NOT-PRODUCTION' });
    res.end(JSON.stringify(body));
  }

  private async body(req: IncomingMessage): Promise<any> {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const t = Buffer.concat(chunks).toString('utf8');
    return t ? JSON.parse(t) : {};
  }

  private async handle(req: IncomingMessage, res: ServerResponse) {
    const method = req.method || 'GET';
    const path = (req.url || '/').split('?')[0];
    const auth = String(req.headers.authorization || '');
    const idem = req.headers['x-idempotency-key'] ? String(req.headers['x-idempotency-key']) : undefined;
    this.calls.push({ method, path, idem, callerId: req.headers['x-caller-id'] ? String(req.headers['x-caller-id']) : undefined });
    if (!auth.startsWith('Bearer TEST-FAKE-')) return this.send(res, 401, { message: 'fake MP accepts only TEST-FAKE- tokens' });
    if (this.delayMs) await new Promise((r) => setTimeout(r, this.delayMs));
    const f = this.failures.find((x) => x.remaining > 0 && x.match(method, path));
    if (f) {
      f.remaining--;
      return this.send(res, f.status, { message: `fake MP injected ${f.status}` });
    }
    try {
      let m: RegExpMatchArray | null;
      if (method === 'POST' && path === '/v1/payments') {
        const b = await this.body(req);
        if (idem && this.idemPayments.has(idem)) return this.send(res, 201, this.view(this.payments.get(this.idemPayments.get(idem)!)!));
        const isPix = b.payment_method_id === 'pix';
        const p = this.addPayment({
          transaction_amount: Number(b.transaction_amount),
          external_reference: b.external_reference ?? null,
          payment_method_id: isPix ? 'pix' : String(b.payment_method_id || 'visa'),
          ...(isPix ? { status: 'pending', status_detail: 'pending_waiting_transfer' } : this.nextCardStatus),
        });
        if (idem) this.idemPayments.set(idem, p.id);
        return this.send(res, 201, this.view(p));
      }
      if ((m = path.match(/^\/v1\/payments\/([^/]+)\/refunds$/))) {
        const p = this.payments.get(decodeURIComponent(m[1]));
        if (!p) return this.send(res, 404, { message: 'payment not found' });
        if (method === 'GET') return this.send(res, 200, (this.refunds.get(p.id) || []).map(({ idem: _i, ...r }) => r));
        if (method === 'POST') {
          const b = await this.body(req);
          if (idem && this.idemRefunds.has(idem)) {
            const { idem: _i, ...r } = this.idemRefunds.get(idem)!;
            return this.send(res, 201, r);
          }
          if (p.status !== 'approved') return this.send(res, 400, { message: 'Payment not in a refundable state', cause: [{ code: 2063 }] });
          const remaining = Math.round((p.transaction_amount - p.transaction_amount_refunded) * 100) / 100;
          const amount = b.amount != null ? Number(b.amount) : remaining;
          if (amount > remaining + 0.001) return this.send(res, 400, { message: 'Invalid refund amount', cause: [{ code: 4040 }] });
          if (this.refundStatus === 'rejected') return this.send(res, 400, { message: 'refund rejected (fake)' });
          const r: FakeMpRefund = { id: String(++this.seq), payment_id: p.id, amount, status: this.refundStatus, idem: idem || '' };
          if (idem) this.idemRefunds.set(idem, r);
          this.refunds.set(p.id, [...(this.refunds.get(p.id) || []), r]);
          if (r.status === 'approved') this.applyRefund(p, amount);
          const { idem: _i, ...out } = r;
          return this.send(res, 201, out);
        }
      }
      if ((m = path.match(/^\/v1\/payments\/([^/]+)$/))) {
        const p = this.payments.get(decodeURIComponent(m[1]));
        if (!p) return this.send(res, 404, { message: 'payment not found' });
        if (method === 'GET') return this.send(res, 200, this.view(p));
        if (method === 'PUT') {
          const b = await this.body(req);
          if (b.status === 'cancelled' && p.status === 'pending') Object.assign(p, { status: 'cancelled', status_detail: 'by_collector' });
          return this.send(res, 200, this.view(p));
        }
      }
      if ((m = path.match(/^\/v1\/chargebacks\/([^/]+)$/)) && method === 'GET') {
        const c = this.chargebacks.get(decodeURIComponent(m[1]));
        if (!c) return this.send(res, 404, { message: 'chargeback not found' });
        return this.send(res, 200, c);
      }
      return this.send(res, 404, { message: `fake MP: no route ${method} ${path}` });
    } catch (e: any) {
      return this.send(res, 500, { message: String(e?.message || e) });
    }
  }

  /** Completes an in_process refund out-of-band (as MP would later). */
  settleRefund(paymentId: string, refundId: string, status: 'approved' | 'rejected') {
    const r = (this.refunds.get(paymentId) || []).find((x) => x.id === refundId);
    const p = this.payments.get(paymentId);
    if (!r || !p) throw new Error('fake MP: refund not found');
    r.status = status;
    if (status === 'approved') this.applyRefund(p, r.amount);
  }

  private applyRefund(p: FakeMpPayment, amount: number) {
    p.transaction_amount_refunded = Math.round((p.transaction_amount_refunded + amount) * 100) / 100;
    if (p.transaction_amount_refunded + 0.001 >= p.transaction_amount) {
      p.status = 'refunded';
      p.status_detail = 'refunded';
    } else {
      p.status_detail = 'partially_refunded';
    }
  }

  private view(p: FakeMpPayment) {
    return {
      ...p,
      point_of_interaction: p.payment_method_id === 'pix' ? { transaction_data: { qr_code: `TEST-FAKE-QR-${p.id}`, qr_code_base64: null, ticket_url: null } } : undefined,
    };
  }
}
