/**
 * TEST ONLY — local TCP proxy in front of the LOCAL test Postgres. `down()` closes the listener and
 * destroys every open connection (the app sees the database vanish mid-flight: ECONNRESET /
 * connection refused); `up()` starts accepting again on the same port. Never used outside tests.
 */
import { createConnection, createServer, Server, Socket } from 'net';

export class KillableDbProxy {
  private server: Server | null = null;
  private sockets = new Set<Socket>();
  port = 0;
  isUp = false;
  constructor(private readonly targetHost: string, private readonly targetPort: number) {}

  async up(): Promise<number> {
    if (this.isUp) return this.port;
    this.server = createServer((client) => {
      const upstream = createConnection({ host: this.targetHost, port: this.targetPort });
      this.sockets.add(client);
      this.sockets.add(upstream);
      const drop = () => { client.destroy(); upstream.destroy(); this.sockets.delete(client); this.sockets.delete(upstream); };
      client.on('error', drop); upstream.on('error', drop); client.on('close', drop); upstream.on('close', drop);
      client.pipe(upstream); upstream.pipe(client);
    });
    await new Promise<void>((resolve, reject) => {
      this.server!.once('error', reject);
      this.server!.listen(this.port, '127.0.0.1', () => resolve());
    });
    this.port = (this.server.address() as { port: number }).port;
    this.isUp = true;
    return this.port;
  }

  async down(): Promise<void> {
    if (!this.isUp) return;
    this.isUp = false;
    for (const s of this.sockets) s.destroy();
    this.sockets.clear();
    await new Promise<void>((r) => this.server!.close(() => r()));
    this.server = null;
  }
}
