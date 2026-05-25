'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/shared/api/client-api';
import { Appointment, Doctor, Service } from '@/shared/types/bootstrap';

type ListResponse<T> = { items: T[]; total: number; page: number; pageSize: number };

export function useAppointments(branchId?: string, date: Date = new Date()) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);
  const params = new URLSearchParams({
    dateFrom: startOfDay.toISOString(),
    dateTo: endOfDay.toISOString(),
    ...(branchId ? { branchId } : {}),
  });
  return useQuery({
    queryKey: ['appointments', branchId, startOfDay.toISOString()],
    queryFn: () => apiFetch<ListResponse<Appointment>>(`/appointments?${params}`),
  });
}

export function useServices() {
  return useQuery({ queryKey: ['services'], queryFn: () => apiFetch<Service[]>('/services') });
}

export function useDoctors() {
  return useQuery({ queryKey: ['doctors'], queryFn: () => apiFetch<Doctor[]>('/doctors') });
}

export function useCreateAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      branchId: string;
      patientId: string;
      employeeId: string;
      serviceId?: string;
      startAt: string;
      endAt: string;
      notes?: string;
    }) => apiFetch<Appointment>('/appointments', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['reception-dashboard'] });
    },
  });
}

export function useTransitionAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'confirm' | 'check-in' | 'cancel' }) =>
      apiFetch<Appointment>(`/appointments/${id}/${action}`, {
        method: 'POST',
        body: JSON.stringify({ reason: action }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['appointments-week'] });
      queryClient.invalidateQueries({ queryKey: ['reception-dashboard'] });
    },
  });
}

export function useReschedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      newStartAt,
      newEndAt,
    }: {
      id: string;
      newStartAt: string;
      newEndAt: string;
    }) =>
      apiFetch<Appointment>(`/appointments/${id}/reschedule`, {
        method: 'POST',
        body: JSON.stringify({ newStartAt, newEndAt }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['appointments-week'] });
      queryClient.invalidateQueries({ queryKey: ['reception-dashboard'] });
    },
  });
}

export function useWeekAppointments(branchId?: string, startDate: Date = new Date()) {
  const startOfWeek = new Date(startDate);
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 7);
  const params = new URLSearchParams({
    dateFrom: startOfWeek.toISOString(),
    dateTo: endOfWeek.toISOString(),
    ...(branchId ? { branchId } : {}),
  });
  return useQuery({
    queryKey: ['appointments-week', branchId, startOfWeek.toISOString()],
    queryFn: () => apiFetch<ListResponse<Appointment>>(`/appointments?${params}`),
  });
}

export function useWeekAvailability(
  branchId: string,
  employeeId?: string,
  serviceId?: string,
  startDate?: string,
) {
  const params = new URLSearchParams({
    branchId,
    ...(employeeId ? { employeeId } : {}),
    ...(serviceId ? { serviceId } : {}),
    ...(startDate ? { startDate } : { startDate: new Date().toISOString().split('T')[0] }),
  });
  return useQuery({
    queryKey: ['week-availability', branchId, employeeId, serviceId, startDate],
    queryFn: () =>
      apiFetch<{
        startDate: string;
        days: Array<{ date: string; slots: string[]; slotsCount: number }>;
      }>(`/availability/week?${params}`),
    enabled: !!branchId,
  });
}

export function useRoomUtilization(branchId: string, dateFrom: string, dateTo: string) {
  const params = new URLSearchParams({ branchId, dateFrom, dateTo });
  return useQuery({
    queryKey: ['room-utilization', branchId, dateFrom, dateTo],
    queryFn: () =>
      apiFetch<
        Array<{
          roomId: string;
          roomName: string;
          roomCode: string;
          totalAppointments: number;
          totalMinutesBooked: number;
          totalMinutesAvailable: number;
          utilizationPercent: number;
        }>
      >(`/rooms/utilization?${params}`),
    enabled: !!branchId && !!dateFrom && !!dateTo,
  });
}
