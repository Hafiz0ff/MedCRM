import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Hl7MllpServer } from './hl7-mllp.server';

// Mock ConfigService
const mockConfigService = {
  get: (key: string, def: string) => def,
} as any;

// Mock PrismaService
const mockPrismaService = {
  tenant: {
    findFirst: async () => ({ id: 'tenant-123', code: 'demo' }),
  },
  integrationProvider: {
    findFirst: async () => ({ id: 'provider-123', providerCode: 'HL7' }),
  },
} as any;

// Mock InboxProcessor
let processedMessage: any = null;
const mockInboxProcessor = {
  processInbound: async (
    tenantId: string,
    providerId: string,
    messageControlId: string,
    messageType: string,
    rawMessage: string,
    payloadJson: any,
  ) => {
    processedMessage = {
      tenantId,
      providerId,
      messageControlId,
      messageType,
      rawMessage,
      payloadJson,
    };
    return { id: 'inbox-123' };
  },
} as any;

describe('Hl7MllpServer parsing', () => {
  it('correctly parses ADT message and generates AA ACK', async () => {
    processedMessage = null;
    const server = new Hl7MllpServer(mockConfigService, mockPrismaService, mockInboxProcessor);
    const hl7 =
      'MSH|^~\\&|SENDING_APP|SENDING_FACILITY|REC_APP|REC_FACILITY|20260528190000||ADT^A01|MSG-001|P|2.3\rPID|||12345||Иванов^Иван^Иванович';

    // Access the private method processHl7Message using bracket notation
    const ack = await (server as any).processHl7Message(hl7);

    assert.match(ack, /MSA\|AA\|MSG-001/);
    assert.ok(processedMessage);
    assert.equal(processedMessage.messageControlId, 'MSG-001');
    assert.equal(processedMessage.messageType, 'ADT^A01');
  });

  it('handles invalid messages and generates AE ACK', async () => {
    const server = new Hl7MllpServer(mockConfigService, mockPrismaService, mockInboxProcessor);
    const invalidHl7 = 'INVALID_SEGMENT|^~\\&|||||||||';

    const ack = await (server as any).processHl7Message(invalidHl7);

    assert.match(ack, /MSA\|AE\|UNKNOWN/);
    assert.match(ack, /ERR\|\|\|Invalid message/);
  });
});
