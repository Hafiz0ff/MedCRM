import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ScimController } from '../../../auth-service/src/sso/scim.controller';
import { BillingGuard } from './billing.guard';

describe('BillingGuard lockout logic', () => {
  it('permits read-only HTTP methods regardless of subscription status', async () => {
    const mockPrisma = {} as any;
    const guard = new BillingGuard(mockPrisma);

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'GET',
          user: { tenantId: 'tenant-1' },
        }),
      }),
    } as any;

    const result = await guard.canActivate(mockContext);
    assert.equal(result, true);
  });

  it('allows state-changing write operations for active subscriptions', async () => {
    const mockPrisma = {
      tenantSubscription: {
        findFirst: async () => ({
          tenantId: 'tenant-123',
          subscriptionStatus: 'ACTIVE',
          tenant: { status: 'ACTIVE' },
        }),
      },
    } as any;
    const guard = new BillingGuard(mockPrisma);

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'POST',
          user: { tenantId: 'tenant-123' },
        }),
      }),
    } as any;

    const result = await guard.canActivate(mockContext);
    assert.equal(result, true);
  });

  it('blocks write operations for suspended or overdue subscriptions', async () => {
    const mockPrisma = {
      tenantSubscription: {
        findFirst: async () => ({
          tenantId: 'tenant-123',
          subscriptionStatus: 'SUSPENDED',
          tenant: { status: 'ACTIVE' },
        }),
      },
    } as any;
    const guard = new BillingGuard(mockPrisma);

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'POST',
          user: { tenantId: 'tenant-123' },
        }),
      }),
    } as any;

    await assert.rejects(
      async () => {
        await guard.canActivate(mockContext);
      },
      (err: any) => {
        assert.equal(err.status, 403);
        assert.equal(err.response.error.code, 'SUBSCRIPTION_SUSPENDED');
        return true;
      },
    );
  });
});

describe('ScimController directory provisioning', () => {
  it('correctly retrieves and maps users lists into SCIM Core schemas', async () => {
    const mockPrisma = {
      user: {
        findMany: async () => [
          {
            id: 'user-1',
            email: 'doctor@clinic.com',
            firstName: 'Иван',
            lastName: 'Иванов',
            status: 'active',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      },
    } as any;

    const controller = new ScimController(mockPrisma);
    const request = {
      headers: {
        'x-tenant-id': 'tenant-123',
      },
    } as any;

    const response = await controller.listUsers(request);

    assert.equal(response.totalResults, 1);
    assert.equal(response.Resources[0].userName, 'doctor@clinic.com');
    assert.equal(response.Resources[0].name.formatted, 'Иван Иванов');
    assert.equal(response.Resources[0].active, true);
  });
});
