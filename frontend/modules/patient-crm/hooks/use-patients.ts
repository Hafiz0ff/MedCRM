'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/shared/api/client-api';
import { Patient } from '@/shared/types/bootstrap';

type ListResponse = {
  items: Patient[];
  total: number;
  page: number;
  pageSize: number;
  duplicateCandidates?: Patient[];
};

export function usePatients(q: string, status?: string, tagId?: string) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (status) params.set('status', status);
  if (tagId) params.set('tagId', tagId);

  const queryString = params.toString();
  const url = queryString ? `/patients/search?${queryString}` : '/patients';

  return useQuery({
    queryKey: ['patients', q, status, tagId],
    queryFn: () => apiFetch<ListResponse>(url),
  });
}

export function usePatient(id: string) {
  return useQuery({
    queryKey: ['patient', id],
    queryFn: () => apiFetch<Patient>(`/patients/${id}`),
  });
}

export function useCreatePatient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      firstName: string;
      lastName: string;
      phone?: string;
      registrationBranchId?: string;
    }) => apiFetch<Patient>('/patients', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: (patient) => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      queryClient.setQueryData(['patient', patient.id], patient);
    },
  });
}

export function useUpdatePatient(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<Patient>) =>
      apiFetch<Patient>(`/patients/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
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
    },
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
    queryFn: () => apiFetch<PatientTimelineEvent[]>(`/patients/${id}/timeline`),
  });
}

export function useAddPatientContact(patientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (contact: { type: string; value: string; isPrimary?: boolean; comment?: string }) =>
      apiFetch<any>(`/patients/${patientId}/contacts`, {
        method: 'POST',
        body: JSON.stringify(contact),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient', patientId] });
      queryClient.invalidateQueries({ queryKey: ['patient-timeline', patientId] });
    },
  });
}

export function useDeletePatientContact(patientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (contactId: string) =>
      apiFetch<any>(`/patients/${patientId}/contacts/${contactId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient', patientId] });
      queryClient.invalidateQueries({ queryKey: ['patient-timeline', patientId] });
    },
  });
}

export function useAddPatientNote(patientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (note: { noteText: string; isPinned?: boolean }) =>
      apiFetch<any>(`/patients/${patientId}/notes`, { method: 'POST', body: JSON.stringify(note) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient', patientId] });
      queryClient.invalidateQueries({ queryKey: ['patient-timeline', patientId] });
    },
  });
}

export function useListTags() {
  return useQuery({
    queryKey: ['patient-tags'],
    queryFn: () =>
      apiFetch<Array<{ id: string; name: string; color: string; code: string }>>('/patients/tags'),
  });
}

export function useAssignPatientTag(patientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tagId: string) =>
      apiFetch<any>(`/patients/${patientId}/tags/${tagId}`, { method: 'POST', body: '{}' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient', patientId] });
      queryClient.invalidateQueries({ queryKey: ['patient-timeline', patientId] });
    },
  });
}

export function useRemovePatientTag(patientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tagId: string) =>
      apiFetch<any>(`/patients/${patientId}/tags/${tagId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient', patientId] });
      queryClient.invalidateQueries({ queryKey: ['patient-timeline', patientId] });
    },
  });
}
