'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/shared/api/client-api';

export type MedicalRecord = {
  id: string;
  patientId: string;
  bloodType?: string | null;
  allergiesJson?: any | null;
  chronicConditionsJson?: any | null;
  emergencyContactsJson?: any | null;
  createdAt: string;
  updatedAt: string;
};

export type EpisodeOfCare = {
  id: string;
  patientId: string;
  branchId: string;
  responsibleDoctorId: string;
  episodeType: string;
  title: string;
  status: 'ACTIVE' | 'CLOSED' | 'SUSPENDED';
  startDate: string;
  endDate?: string | null;
  clinicalSummary?: string | null;
  createdAt: string;
  updatedAt: string;
  responsibleDoctor?: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
};

export type EncounterElement = {
  fieldCode: string;
  fieldType: string;
  fieldValueJson: any;
  unit?: string | null;
  terminologyCode?: string | null;
};

export type EncounterSection = {
  sectionCode: string;
  sectionName: string;
  sortOrder: number;
  elements: EncounterElement[];
};

export type EncounterComposition = {
  id: string;
  templateId?: string | null;
  compositionType: string;
  title: string;
  sections: EncounterSection[];
};

export type Encounter = {
  id: string;
  patientId: string;
  appointmentId?: string | null;
  episodeId?: string | null;
  doctorEmployeeId: string;
  departmentId?: string | null;
  encounterType: string;
  status: 'DRAFT' | 'SIGNED';
  startedAt: string;
  signedAt?: string | null;
  signedBy?: string | null;
  compositions: EncounterComposition[];
  createdAt: string;
  updatedAt: string;
  doctor?: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  diagnoses?: Array<{
    id: string;
    diagnosisCode: string;
    diagnosisType: string;
    isPrimary: boolean;
    notes?: string | null;
  }>;
  prescriptions?: Array<{
    id: string;
    prescriptionType: string;
    notes?: string | null;
    items: Array<{
      id: string;
      itemCode: string;
      itemName: string;
      dosage?: string | null;
      frequency?: string | null;
      duration?: string | null;
      instructions?: string | null;
    }>;
  }>;
};

export type ClinicalTemplate = {
  id: string;
  code: string;
  name: string;
  version: number;
  schemaJson: any;
  uiSchemaJson: any;
};

export type Diagnosis = {
  code: string;
  name: string;
  class?: string | null;
};

export function useMedicalRecord(patientId: string) {
  return useQuery({
    queryKey: ['medical-record', patientId],
    queryFn: () => apiFetch<MedicalRecord>(`/emr/medical-records/patient/${patientId}`),
  });
}

export function useUpdateMedicalRecord(patientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<MedicalRecord>) =>
      apiFetch<MedicalRecord>(`/emr/medical-records/patient/${patientId}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medical-record', patientId] });
    },
  });
}

export function useEpisodes(patientId: string) {
  return useQuery({
    queryKey: ['episodes', patientId],
    queryFn: () => apiFetch<EpisodeOfCare[]>(`/emr/episodes?patientId=${patientId}`),
  });
}

export function useCreateEpisode(patientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      branchId: string;
      responsibleDoctorId: string;
      episodeType: string;
      title: string;
      startDate: string;
      clinicalSummary?: string;
    }) =>
      apiFetch<EpisodeOfCare>('/emr/episodes', {
        method: 'POST',
        body: JSON.stringify({ ...input, patientId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['episodes', patientId] });
    },
  });
}

export function useUpdateEpisode(patientId: string, episodeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      status?: 'ACTIVE' | 'CLOSED' | 'SUSPENDED';
      endDate?: string | null;
      clinicalSummary?: string | null;
      responsibleDoctorId?: string;
    }) =>
      apiFetch<EpisodeOfCare>(`/emr/episodes/${episodeId}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['episodes', patientId] });
    },
  });
}

export function useClinicalTemplates() {
  return useQuery({
    queryKey: ['clinical-templates'],
    queryFn: () => apiFetch<ClinicalTemplate[]>('/emr/templates'),
  });
}

export function useEncounterDetails(id: string) {
  return useQuery({
    queryKey: ['encounter', id],
    queryFn: () => apiFetch<Encounter>(`/emr/encounters/${id}`),
    enabled: !!id,
  });
}

export function useEncounterVersions(id: string) {
  return useQuery({
    queryKey: ['encounter-versions', id],
    queryFn: () => apiFetch<any[]>(`/emr/encounters/${id}/versions`),
    enabled: !!id,
  });
}

export function useSaveEncounterDraft(patientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id?: string;
      appointmentId?: string | null;
      episodeId?: string | null;
      doctorEmployeeId: string;
      departmentId?: string | null;
      encounterType: string;
      startedAt: string;
      compositions?: any[];
    }) => {
      const { id, ...data } = input;
      const url = id ? `/emr/encounters/${id}` : '/emr/encounters';
      const method = id ? 'PATCH' : 'POST';
      return apiFetch<Encounter>(url, {
        method,
        body: JSON.stringify({ ...data, patientId }),
      });
    },
    onSuccess: (encounter) => {
      queryClient.invalidateQueries({ queryKey: ['patient-timeline', patientId] });
      queryClient.invalidateQueries({ queryKey: ['encounter', encounter.id] });
    },
  });
}

export function useSignEncounter(patientId: string, id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      certificateSerial?: string | null;
      signatureProvider: string;
      signatureHash: string;
    }) =>
      apiFetch<Encounter>(`/emr/encounters/${id}/sign`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['encounter', id] });
      queryClient.invalidateQueries({ queryKey: ['patient-timeline', patientId] });
    },
  });
}

export function useAmendEncounter(patientId: string, id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { amendmentReason: string }) =>
      apiFetch<Encounter>(`/emr/encounters/${id}/amend`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['encounter', id] });
      queryClient.invalidateQueries({ queryKey: ['encounter-versions', id] });
      queryClient.invalidateQueries({ queryKey: ['patient-timeline', patientId] });
    },
  });
}

export function useAssignDiagnosis(patientId: string, encounterId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      diagnosisCode: string;
      diagnosisType: 'PRELIMINARY' | 'CLINICAL' | 'FINAL' | 'DIFFERENTIAL';
      isPrimary?: boolean;
      notes?: string | null;
    }) =>
      apiFetch<any>(`/emr/encounters/${encounterId}/diagnoses`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['encounter', encounterId] });
    },
  });
}

export function useCreatePrescription(patientId: string, encounterId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      diagnosisId?: string | null;
      prescriptionType:
        | 'MEDICATION'
        | 'LAB_ORDER'
        | 'PROCEDURE'
        | 'IMAGING'
        | 'REFERRAL'
        | 'FOLLOW_UP';
      notes?: string | null;
      items: Array<{
        itemCode: string;
        itemName: string;
        dosage?: string | null;
        frequency?: string | null;
        duration?: string | null;
        route?: string | null;
        quantity?: number | null;
        instructions?: string | null;
        linkedServiceId?: string | null;
      }>;
    }) =>
      apiFetch<any>(`/emr/encounters/${encounterId}/prescriptions`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['encounter', encounterId] });
    },
  });
}
