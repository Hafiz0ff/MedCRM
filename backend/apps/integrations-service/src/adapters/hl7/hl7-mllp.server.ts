import * as net from 'node:net';
import { PrismaService } from '@core/database/prisma.service';
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InboxProcessor } from '../../core/inbox-processor';

@Injectable()
export class Hl7MllpServer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(Hl7MllpServer.name);
  private server!: net.Server;
  private port!: number;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly inboxProcessor: InboxProcessor,
  ) {}

  onModuleInit() {
    this.port = Number(this.config.get<string>('HL7_MLLP_PORT', '2575'));
    this.server = net.createServer((socket) => this.handleConnection(socket));

    this.server.listen(this.port, '0.0.0.0', () => {
      this.logger.log(`HL7 MLLP TCP Server listening on port ${this.port}`);
    });
  }

  onModuleDestroy() {
    if (this.server) {
      this.server.close();
      this.logger.log('HL7 MLLP TCP Server stopped.');
    }
  }

  private handleConnection(socket: net.Socket) {
    this.logger.log(`New MLLP connection from ${socket.remoteAddress}:${socket.remotePort}`);
    let buffer = Buffer.alloc(0);

    socket.on('data', async (data) => {
      buffer = Buffer.concat([buffer, data]);

      // MLLP Framing: VT (0x0B) ... FS (0x1C) CR (0x0D)
      let vtIndex = buffer.indexOf(0x0b);
      while (vtIndex !== -1) {
        const fsIndex = buffer.indexOf(0x1c, vtIndex);
        if (fsIndex !== -1 && fsIndex + 1 < buffer.length && buffer[fsIndex + 1] === 0x0d) {
          // Found a complete MLLP frame
          const messageBuffer = buffer.subarray(vtIndex + 1, fsIndex);
          const rawMessage = messageBuffer.toString('utf8');

          // Process the HL7 message
          const ackMessage = await this.processHl7Message(rawMessage);

          // Send ACK response wrapped in MLLP frame
          const responseBuffer = Buffer.concat([
            Buffer.from([0x0b]),
            Buffer.from(ackMessage, 'utf8'),
            Buffer.from([0x1c, 0x0d]),
          ]);
          socket.write(responseBuffer);

          // Slice buffer and search again
          buffer = buffer.subarray(fsIndex + 2);
          vtIndex = buffer.indexOf(0x0b);
        } else {
          break; // Incomplete frame
        }
      }
    });

    socket.on('error', (err) => {
      this.logger.error(`MLLP Socket error: ${err.message}`);
    });

    socket.on('close', () => {
      this.logger.log('MLLP connection closed');
    });
  }

  private async processHl7Message(rawMessage: string): Promise<string> {
    // Standard segment separator is CR (\r) or LF (\n)
    const lines = rawMessage
      .split(/[\r\n]+/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0 || !lines[0].startsWith('MSH')) {
      return this.generateAck('AE', 'UNKNOWN', 'Invalid message: MSH segment missing');
    }

    // Parse MSH fields
    const msh = lines[0];
    const separator = msh.charAt(3); // typically '|'
    const fields = msh.split(separator);

    // Delimiter field count: MSH field 1 is separator, fields start after
    // fields[0] = 'MSH'
    // fields[1] = encoding characters (e.g. '^~\&')
    // fields[2] = sending application
    // fields[3] = sending facility (often tenant code or ID)
    // fields[8] = message type (e.g. ADT^A01)
    // fields[9] = message control ID
    const sendingApp = fields[2] || 'UNKNOWN';
    const sendingFacility = fields[3] || '';
    const messageType = fields[8] || 'ADT^A01';
    const messageControlId = fields[9] || 'MSGID-UNKNOWN';

    // Try to resolve tenant
    let tenantId = '';
    const resolvedTenant = await this.prisma.tenant.findFirst({
      where: sendingFacility
        ? {
            OR: [
              { id: sendingFacility.length === 36 ? sendingFacility : undefined },
              { code: sendingFacility },
            ],
          }
        : {},
    });

    if (resolvedTenant) {
      tenantId = resolvedTenant.id;
    } else {
      // Fallback to first active tenant for testing/sandbox
      const firstTenant = await this.prisma.tenant.findFirst({
        where: { status: 'active' },
      });
      if (firstTenant) tenantId = firstTenant.id;
    }

    if (!tenantId) {
      return this.generateAck('AE', messageControlId, 'Tenant context could not be resolved');
    }

    // Resolve matching provider
    const provider = await this.prisma.integrationProvider.findFirst({
      where: { tenantId, providerType: 'LIS' },
    });

    if (!provider) {
      return this.generateAck(
        'AE',
        messageControlId,
        `No active LIS integration provider registered for tenant ${tenantId}`,
      );
    }

    try {
      // Send to InboxProcessor for async or sync processing
      await this.inboxProcessor.processInbound(
        tenantId,
        provider.id,
        messageControlId,
        messageType,
        rawMessage,
        { segments: lines.map((l) => l.split(separator)) },
      );

      return this.generateAck('AA', messageControlId);
    } catch (err: any) {
      return this.generateAck('AE', messageControlId, err.message);
    }
  }

  private generateAck(status: 'AA' | 'AE' | 'AR', controlId: string, errorMsg?: string): string {
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:T.Z]/g, '')
      .slice(0, 14);
    let ack = `MSH|^~\\&|MedCRM|SYSTEM|||${timestamp}||ACK||P|2.3\r`;
    ack += `MSA|${status}|${controlId}`;
    if (errorMsg) {
      ack += `\rERR|||${errorMsg}`;
    }
    return ack;
  }
}
