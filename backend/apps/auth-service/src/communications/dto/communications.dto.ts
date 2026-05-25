import { z } from 'zod';

export const SendMessageSchema = z.object({
  messageText: z.string().optional().nullable(),
  mediaFileId: z.string().uuid().optional().nullable(),
  channelType: z.enum(['TELEGRAM', 'WHATSAPP', 'SMS', 'EMAIL', 'INTERNAL', 'WEBCHAT']),
});
export type SendMessageDto = z.infer<typeof SendMessageSchema>;

export const AssignConversationSchema = z.object({
  operatorId: z.string().uuid(),
});
export type AssignConversationDto = z.infer<typeof AssignConversationSchema>;

export const CreateTemplateSchema = z.object({
  templateCode: z.string().min(1).max(80),
  templateName: z.string().min(1).max(255),
  channelType: z.enum(['TELEGRAM', 'WHATSAPP', 'SMS', 'EMAIL', 'INTERNAL', 'WEBCHAT']),
  languageCode: z.string().min(2).max(10).default('ru'),
  subject: z.string().max(255).optional().nullable(),
  templateBody: z.string().min(1),
  variablesJson: z.any().optional().default({}),
});
export type CreateTemplateDto = z.infer<typeof CreateTemplateSchema>;

export const UpdateTemplateSchema = z.object({
  templateName: z.string().min(1).max(255).optional(),
  templateBody: z.string().min(1).optional(),
  variablesJson: z.any().optional(),
  isActive: z.boolean().optional(),
});
export type UpdateTemplateDto = z.infer<typeof UpdateTemplateSchema>;

export const CreateNotificationRuleSchema = z.object({
  ruleName: z.string().min(1).max(255),
  triggerEvent: z.string().min(1).max(120),
  channelType: z.enum(['TELEGRAM', 'WHATSAPP', 'SMS', 'EMAIL', 'INTERNAL', 'WEBCHAT']),
  templateId: z.string().uuid(),
  delayMinutes: z.number().min(0).default(0),
  conditionsJson: z.any().optional().nullable(),
});
export type CreateNotificationRuleDto = z.infer<typeof CreateNotificationRuleSchema>;

export const CreateCampaignSchema = z.object({
  campaignName: z.string().min(1).max(255),
  targetSegmentJson: z.any(),
  channelType: z.enum(['TELEGRAM', 'WHATSAPP', 'SMS', 'EMAIL', 'INTERNAL', 'WEBCHAT']),
  templateId: z.string().uuid(),
  scheduledAt: z.string().datetime().optional().nullable(),
});
export type CreateCampaignDto = z.infer<typeof CreateCampaignSchema>;

export const UpdatePreferencesSchema = z.object({
  patientId: z.string().uuid(),
  channelType: z.enum(['TELEGRAM', 'WHATSAPP', 'SMS', 'EMAIL', 'INTERNAL', 'WEBCHAT']),
  marketingAllowed: z.boolean().optional(),
  remindersAllowed: z.boolean().optional(),
  isBlocked: z.boolean().optional(),
});
export type UpdatePreferencesDto = z.infer<typeof UpdatePreferencesSchema>;

export const ChatbotWebhookSchema = z.object({
  chatId: z.string(),
  senderName: z.string().optional(),
  text: z.string(),
  externalMessageId: z.string().optional(),
});
export type ChatbotWebhookDto = z.infer<typeof ChatbotWebhookSchema>;

export const UpdateNotificationRuleSchema = z.object({
  ruleName: z.string().min(1).max(255).optional(),
  templateId: z.string().uuid().optional(),
  delayMinutes: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
  conditionsJson: z.any().optional().nullable(),
});
export type UpdateNotificationRuleDto = z.infer<typeof UpdateNotificationRuleSchema>;

export const ConfigureChannelSchema = z.object({
  channelType: z.enum(['TELEGRAM', 'WHATSAPP', 'SMS', 'EMAIL', 'INTERNAL', 'WEBCHAT']),
  providerCode: z.string().min(1).max(80),
  configurationJson: z.any(),
  isActive: z.boolean().optional().default(true),
});
export type ConfigureChannelDto = z.infer<typeof ConfigureChannelSchema>;

export const ConfigureSmsProviderSchema = z.object({
  providerCode: z.string().min(1).max(80),
  providerName: z.string().min(1).max(120),
  apiCredentialsJson: z.any(),
  senderName: z.string().min(1).max(80),
  dailyLimit: z.number().min(0).optional().default(1000),
  isActive: z.boolean().optional().default(true),
});
export type ConfigureSmsProviderDto = z.infer<typeof ConfigureSmsProviderSchema>;
