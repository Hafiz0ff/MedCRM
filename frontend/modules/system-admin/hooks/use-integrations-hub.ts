'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/shared/api/client-api';

// ---------- Types ----------

export type IntegrationLogEntry = {
  id: string;
  tenantId: string;
  providerId: string | null;
  direction: 'INBOUND' | 'OUTBOUND';
  requestPayload: any;
  responsePayload: any;
  statusCode: number;
  executionTimeMs: number;
  correlationId: string | null;
  createdAt: string;
};

export type IntegrationLogPage = {
  page: number;
  pageSize: number;
  total: number;
  items: IntegrationLogEntry[];
};

export type IntegrationInboxEntry = {
  id: string;
  tenantId: string;
  providerId: string;
  externalId: string;
  messageType: string;
  status: 'RECEIVED' | 'PROCESSED' | 'FAILED' | 'IGNORED';
  lastError: string | null;
  processedAt: string | null;
  createdAt: string;
};

export type IntegrationInboxPage = {
  page: number;
  pageSize: number;
  total: number;
  items: IntegrationInboxEntry[];
};

export type IntegrationStats = {
  totalProviders: number;
  activeProviders: number;
  logsLast24h: number;
  inboxByStatus: Record<string, number>;
  logsByDirection: Record<string, number>;
};

export type AdapterInfo = {
  kind: string;
  fields: Array<{ name: string; label: string; type: string; required: boolean }>;
};

// ---------- Filter types ----------

export type LogFilters = {
  page?: number;
  pageSize?: number;
  providerId?: string;
  direction?: string;
  dateFrom?: string;
  dateTo?: string;
};

export type InboxFilters = {
  page?: number;
  pageSize?: number;
  providerId?: string;
  status?: string;
};

// ---------- Query keys ----------

const QK = {
  logs: (filters: LogFilters) => ['integration', 'logs', filters] as const,
  inbox: (filters: InboxFilters) => ['integration', 'inbox', filters] as const,
  stats: ['integration', 'stats'] as const,
  adapters: ['integration', 'adapters'] as const,
};

export const IntegrationHubQueryKeys = QK;

// ---------- Logs ----------

export function useIntegrationLogs(filters: LogFilters) {
  return useQuery({
    queryKey: QK.logs(filters),
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters.page) params.set('page', String(filters.page));
      if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
      if (filters.providerId) params.set('providerId', filters.providerId);
      if (filters.direction) params.set('direction', filters.direction);
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.set('dateTo', filters.dateTo);
      const qs = params.toString();
      return apiFetch<IntegrationLogPage>(`/integration/admin/logs${qs ? `?${qs}` : ''}`);
    },
    placeholderData: (prev) => prev,
  });
}

// ---------- Inbox ----------

export function useIntegrationInbox(filters: InboxFilters) {
  return useQuery({
    queryKey: QK.inbox(filters),
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters.page) params.set('page', String(filters.page));
      if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
      if (filters.providerId) params.set('providerId', filters.providerId);
      if (filters.status) params.set('status', filters.status);
      const qs = params.toString();
      return apiFetch<IntegrationInboxPage>(`/integration/admin/inbox${qs ? `?${qs}` : ''}`);
    },
    placeholderData: (prev) => prev,
  });
}

export function useReplayInboxMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (messageId: string) =>
      apiFetch<{ ok: true }>(`/integration/admin/inbox/${messageId}/replay`, {
        method: 'POST',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['integration', 'inbox'] });
      qc.invalidateQueries({ queryKey: ['integration', 'stats'] });
    },
  });
}

// ---------- Stats ----------

export function useIntegrationStats() {
  return useQuery({
    queryKey: QK.stats,
    queryFn: () => apiFetch<IntegrationStats>('/integration/admin/stats'),
  });
}

// ---------- Adapters ----------

export function useAdapterList() {
  return useQuery({
    queryKey: QK.adapters,
    queryFn: () => apiFetch<AdapterInfo[]>('/integration/admin/adapters'),
  });
}
