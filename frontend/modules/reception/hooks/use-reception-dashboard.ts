'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/shared/api/client-api';
import { Appointment, Patient } from '@/shared/types/bootstrap';

export type DashboardCounters = {
  total: number;
  waiting: number;
  checkedIn: number;
  inProgress: number;
  completedPendingPayment: number;
  completed: number;
  cancelled: number;
  noShow: number;
};

export type ReceptionAppointment = {
  id: string;
  patientId: string;
  patientName: string;
  patientCode: string;
  patient: { fullName: string };
  service?: { id: string; name: string } | null;
  appointmentNumber: string;
  age?: number | null;
  phone?: string | null;
  doctorName?: string | null;
  roomName?: string | null;
  startAt: string;
  endAt: string;
  status: string;
  appointmentType?: string | null;
  isVip?: boolean;
  priority?: string | null;
  debt?: number;
  lastVisitAt?: string | null;
};

export type ReceptionDashboard = {
  branchId: string;
  date: string;
  columns: Record<string, ReceptionAppointment[]>;
  counters: DashboardCounters;
  queue: any[];
  recalculatedAt: string;
};

export function useReceptionDashboard(branchId?: string) {
  return useQuery({
    queryKey: ['reception-dashboard', branchId],
    queryFn: () =>
      apiFetch<ReceptionDashboard>(
        `/reception/dashboard${branchId ? `?branchId=${branchId}` : ''}`,
      ),
  });
}

export function useReceptionTransition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => {
      if (status === 'CHECKED_IN')
        return apiFetch<Appointment>(`/appointments/${id}/check-in`, {
          method: 'POST',
          body: '{}',
        });
      if (status === 'CANCELLED')
        return apiFetch<Appointment>(`/appointments/${id}/cancel`, {
          method: 'POST',
          body: JSON.stringify({ reason: 'Reception board' }),
        });
      if (status === 'CONFIRMED')
        return apiFetch<Appointment>(`/appointments/${id}/confirm`, { method: 'POST', body: '{}' });
      return apiFetch<Appointment>(`/appointments/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reception-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });
}

export function usePatientPreview(patientId?: string) {
  return useQuery({
    queryKey: ['patient-preview', patientId],
    queryFn: () => apiFetch<any>(`/reception/patient-preview/${patientId}`),
    enabled: !!patientId,
  });
}

export function useReceptionCheckIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { appointmentId: string; notes?: string }) =>
      apiFetch<Appointment>('/reception/checkin', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reception-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });
}

export function useFastBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      patientId: string;
      serviceId: string;
      branchId: string;
      employeeId: string;
      startAt: string;
    }) =>
      apiFetch<Appointment>('/appointments/fast-book', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reception-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });
}

export function useUpdateQueuePriority() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, priority }: { id: string; priority: string }) =>
      apiFetch<any>(`/reception/queue/${id}/priority`, {
        method: 'PATCH',
        body: JSON.stringify({ priority }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reception-dashboard'] });
    },
  });
}
