export type EventEnvelope<T = any> = {
  id: string;
  timestamp: string;
  tenantId: string;
  userId?: string;
  correlationId?: string;
  eventType: string;
  payload: T;
};
