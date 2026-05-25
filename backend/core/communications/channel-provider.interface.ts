export interface ChannelProvider {
  readonly channelType: 'SMS' | 'TELEGRAM' | 'WHATSAPP' | 'EMAIL';

  send(input: {
    to: string;
    subject?: string | null;
    body: string;
    meta?: Record<string, any>;
  }): Promise<{
    status: 'SENT' | 'FAILED' | 'QUEUED';
    externalId?: string;
    error?: string;
  }>;
}
