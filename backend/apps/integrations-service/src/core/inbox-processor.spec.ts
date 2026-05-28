import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AdapterRegistry } from './adapter-registry';
import { InboxProcessor } from './inbox-processor';

describe('InboxProcessor', () => {
  it('skips duplicate messages', async () => {
    // Mock Prisma to return a duplicate message
    const mockPrisma = {
      integrationInbox: {
        findUnique: async () => ({ id: 'existing-msg-id', status: 'PROCESSED' }),
      },
    } as any;

    const registry = new AdapterRegistry();
    const mockNats = {} as any;

    const processor = new InboxProcessor(mockPrisma, registry, mockNats);
    const result = await processor.processInbound(
      'tenant-123',
      'provider-123',
      'ext-123',
      'ADT^A08',
      'raw-data',
      { data: 'json' },
    );

    assert.equal(result.id, 'existing-msg-id');
    assert.equal(result.status, 'PROCESSED');
  });

  it('marks as ignored if provider is inactive', async () => {
    let inboxCreated: any = null;
    let inboxUpdated: any = null;

    const mockPrisma = {
      integrationInbox: {
        findUnique: async () => null,
        create: async ({ data }: any) => {
          inboxCreated = { id: 'new-inbox-id', ...data };
          return inboxCreated;
        },
        update: async ({ where, data }: any) => {
          inboxUpdated = { id: where.id, ...data };
          return inboxUpdated;
        },
      },
      integrationProvider: {
        findUnique: async () => ({ id: 'provider-123', isActive: false }),
      },
    } as any;

    const registry = new AdapterRegistry();
    const mockNats = {} as any;

    const processor = new InboxProcessor(mockPrisma, registry, mockNats);
    await processor.processInbound('tenant-123', 'provider-123', 'ext-124', 'ADT^A08', 'raw-data', {
      data: 'json',
    });

    assert.equal(inboxUpdated.status, 'IGNORED');
    assert.equal(inboxUpdated.lastError, 'Provider not found or inactive');
  });
});
