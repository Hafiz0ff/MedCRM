import { randomUUID } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';

export function requestCorrelationMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const incomingRequestId = req.headers['x-request-id'];
  const incomingCorrelationId = req.headers['x-correlation-id'];

  const requestId =
    typeof incomingRequestId === 'string' && incomingRequestId.length > 0
      ? incomingRequestId
      : randomUUID();
  const correlationId =
    typeof incomingCorrelationId === 'string' && incomingCorrelationId.length > 0
      ? incomingCorrelationId
      : requestId;

  req.headers['x-request-id'] = requestId;
  req.headers['x-correlation-id'] = correlationId;

  res.setHeader('X-Request-Id', requestId);
  res.setHeader('X-Correlation-Id', correlationId);
  res.setHeader('X-Gateway-Service', 'medcrm-api-gateway');

  next();
}
