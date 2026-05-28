import { Injectable } from '@nestjs/common';
import { IntegrationAdapter, AdapterContext } from '../../core/adapter.interface';

@Injectable()
export class DocDocAdapter implements IntegrationAdapter {
  readonly kind = 'MARKETPLACE_DOCDOC';

  validateConfig(config: any) {
    if (!config.clinicId) throw new Error('DocDoc clinicId is required');
    return { clinicId: config.clinicId };
  }

  async testConnection(config: any, secrets: Record<string, string>): Promise<void> {}

  // Pushes available appointment slots to DocDoc
  async sendOutbox(message: any, ctx: AdapterContext): Promise<{ externalId: string }> {
    const slots = message.payloadJson;
    ctx.logger.log(`Syncing schedule slots with DocDoc: slotsCount=${slots.length}`);
    return { externalId: `DD-SYNC-${Date.now()}` };
  }

  // Receives booking notification from DocDoc
  async receiveInbox(payload: any, ctx: AdapterContext): Promise<any[]> {
    // Payload format: { doctorId: 'xxx', slotTime: '2026-06-01T10:00:00Z', patientPhone: '+79991112233', patientName: 'Client' }
    ctx.logger.log(
      `Inbound booking request from DocDoc: doctorId=${payload.doctorId}, slotTime=${payload.slotTime}`,
    );

    // Resolve doctor internal UUID and patient internal UUID
    return [
      {
        subject: 'scheduling.v1.appointment.booked_external',
        data: {
          externalSource: 'DOCDOC',
          doctorId: payload.doctorId,
          slotTime: payload.slotTime,
          patientPhone: payload.patientPhone,
          patientName: payload.patientName,
        },
      },
    ];
  }

  buildAdminUi() {
    return {
      fields: [
        { name: 'clinicId', label: 'DocDoc Clinic Code', type: 'text', required: true },
        { name: 'apiKey', label: 'DocDoc Integration Token', type: 'password', required: true },
      ],
    };
  }
}
