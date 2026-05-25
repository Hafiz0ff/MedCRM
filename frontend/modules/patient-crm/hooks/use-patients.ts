'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/shared/api/client-api';
import { Patient } from '@/shared/types/bootstrap';

type ListResponse = { items: Patient[]; total: number; page: number; pageSize: number; duplicateCandidates?: Patient[] };

export function usePatients(q: string) {
  return useQuery({
    queryKey: ['patients', q],
    queryFn: () => apiFetch<ListResponse>(`/patients${q ? `/search?q=${encodeURIComponent(q)}` : ''}`)
  });
}

export function usePatient(id: string) {
  return useQuery({ queryKey: ['patient', id], queryFn: () => apiFetch<Patient>(`/patients/${id}`) });
}

export function useCreatePatient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { firstName: string; lastName: string; phone?: string; registrationBranchId?: string }) =>
      apiFetch<Patient>('/patients', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: (patient) => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      queryClient.setQueryData(['patient', patient.id], patient);
    }
  });
}

export function useUpdatePatient(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<Patient>) => apiFetch<Patient>(`/patients/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ['patient', id] });
      const previous = queryClient.getQueryData<Patient>(['patient', id]);
      if (previous) queryClient.setQueryData(['patient', id], { ...previous, ...input });
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(['patient', id], context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['patient', id] });
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    }
  });
}

export type PatientTimelineEvent = {
  id: string;
  eventType: string;
  title: string;
  body?: string | null;
  eventDate: string;
};

export function usePatientTimeline(id: string) {
  return useQuery({
    queryKey: ['patient-timeline', id],
    queryFn: () => apiFetch<PatientTimelineEvent[]>(`/patients/${id}/timeline`)
  });
}


