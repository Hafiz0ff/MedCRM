import { randomUUID } from 'node:crypto';
import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { TenantContextService } from './tenant-context.service';

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(private readonly tenantContext: TenantContextService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const requestId = String(
      req.headers['x-correlation-id'] ?? req.headers['x-request-id'] ?? randomUUID(),
    );
    res.setHeader('x-correlation-id', requestId);
    const tenantId = req.headers['x-tenant-id'] ? String(req.headers['x-tenant-id']) : undefined;
    const tenantCode = req.headers['x-tenant-code']
      ? String(req.headers['x-tenant-code'])
      : undefined;
    const branchId = req.headers['x-branch-id'] ? String(req.headers['x-branch-id']) : undefined;

    this.tenantContext.run({ requestId, tenantId, tenantCode, branchId }, next);
  }
}
