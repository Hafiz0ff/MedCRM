'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/shared/api/client-api';

export type MessageTemplate = {
  id: string;
  templateCode: string;
  templateName: string;
  channelType: string;
  languageCode: string;
  subject: string | null;
  templateBody: string;
  variablesJson: any;
  isSystem: boolean;
  isActive: boolean;
};

export type NotificationRule = {
  id: string;
  ruleName: string;
  triggerEvent: string;
  channelType: string;
  templateId: string;
  delayMinutes: number;
  conditionsJson: any;
  isActive: boolean;
  template?: MessageTemplate;
};

export type CommunicationChannel = {
  id: string;
  channelType: string;
  providerCode: string;
  configurationJson: any;
  isActive: boolean;
};

export type SmsProvider = {
  id: string;
  providerCode: string;
  providerName: string;
  apiCredentialsJson: any;
  senderName: string;
  dailyLimit: number;
  isActive: boolean;
};

export function useTemplates() {
  return useQuery<MessageTemplate[]>({
    queryKey: ['communications', 'templates'],
    queryFn: () => apiFetch<MessageTemplate[]>('/communications/templates'),
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<MessageTemplate, 'id' | 'isSystem' | 'isActive'>) =>
      apiFetch<MessageTemplate>('/communications/templates', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communications', 'templates'] });
    },
  });
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Omit<MessageTemplate, 'id'>> & { id: string }) =>
      apiFetch<MessageTemplate>(`/communications/templates/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communications', 'templates'] });
    },
  });
}

export function useNotificationRules() {
  return useQuery<NotificationRule[]>({
    queryKey: ['communications', 'rules'],
    queryFn: () => apiFetch<NotificationRule[]>('/communications/rules'),
  });
}

export function useCreateNotificationRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<NotificationRule, 'id' | 'isActive'>) =>
      apiFetch<NotificationRule>('/communications/rules', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communications', 'rules'] });
    },
  });
}

export function useUpdateNotificationRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Omit<NotificationRule, 'id'>> & { id: string }) =>
      apiFetch<NotificationRule>(`/communications/rules/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communications', 'rules'] });
    },
  });
}

export function useDeleteNotificationRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ ok: boolean }>(`/communications/rules/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communications', 'rules'] });
    },
  });
}

export function useChannels() {
  return useQuery<CommunicationChannel[]>({
    queryKey: ['communications', 'channels'],
    queryFn: () => apiFetch<CommunicationChannel[]>('/communications/channels'),
  });
}

export function useConfigureChannel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<CommunicationChannel, 'id'>) =>
      apiFetch<CommunicationChannel>('/communications/channels', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communications', 'channels'] });
    },
  });
}

export function useSmsProviders() {
  return useQuery<SmsProvider[]>({
    queryKey: ['communications', 'sms-providers'],
    queryFn: () => apiFetch<SmsProvider[]>('/communications/sms-providers'),
  });
}

export function useConfigureSmsProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<SmsProvider, 'id'>) =>
      apiFetch<SmsProvider>('/communications/sms-providers', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communications', 'sms-providers'] });
    },
  });
}
