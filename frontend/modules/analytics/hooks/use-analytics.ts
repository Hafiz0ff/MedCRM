'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/shared/api/client-api';

// ---------- Types ----------

export type AnalyticsKpi = {
  activeQueue: number;
  todayRevenue: number;
  last30DaysRevenue: number;
  averageCheck: number;
};

export type MetabaseTokenResponse = {
  iframeUrl: string;
};

export type PredictionResponse = {
  riskScore: number;
  riskCategory: 'LOW' | 'MEDIUM' | 'HIGH';
  reasons: string[];
};

export type ChurnPredictionResponse = {
  churnProbability: number;
  isRisk: boolean;
  segment: string;
};

// ---------- Query keys ----------

const QK = {
  kpi: ['analytics', 'kpi'] as const,
  dashboard: (id: number) => ['analytics', 'dashboard', id] as const,
  metabaseToken: ['analytics', 'metabase-token'] as const,
};

// ---------- Hooks ----------

export function useAnalyticsKpi() {
  return useQuery({
    queryKey: QK.kpi,
    queryFn: () => apiFetch<AnalyticsKpi>('/analytics/kpi'),
  });
}

export function useAnalyticsDashboard<T>(id: number) {
  return useQuery({
    queryKey: QK.dashboard(id),
    queryFn: () => apiFetch<T>(`/analytics/dashboards/${id}`),
  });
}

export function useMetabaseToken() {
  return useQuery({
    queryKey: QK.metabaseToken,
    queryFn: () => apiFetch<MetabaseTokenResponse>('/analytics/metabase-token'),
  });
}

export function useTriggerEtl() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<{ success: boolean; message: string }>('/analytics/etl/trigger', {
        method: 'POST',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
}

export function usePredictNoShow() {
  return useMutation({
    mutationFn: (appointmentId: string) =>
      apiFetch<PredictionResponse>('/analytics/predict/no-show', {
        method: 'POST',
        body: JSON.stringify({ appointmentId }),
      }),
  });
}

export function usePredictChurn() {
  return useMutation({
    mutationFn: (patientId: string) =>
      apiFetch<ChurnPredictionResponse>('/analytics/predict/churn', {
        method: 'POST',
        body: JSON.stringify({ patientId }),
      }),
  });
}
