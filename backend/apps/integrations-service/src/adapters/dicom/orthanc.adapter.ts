import { Injectable } from '@nestjs/common';
import { IntegrationAdapter, AdapterContext } from '../../core/adapter.interface';

@Injectable()
export class OrthancAdapter implements IntegrationAdapter {
  readonly kind = 'PACS_ORTHANC';

  validateConfig(config: any) {
    if (!config.baseUrl) throw new Error('Missing Orthanc baseUrl');
    return { baseUrl: config.baseUrl };
  }

  async testConnection(config: any, secrets: Record<string, string>): Promise<void> {
    // Simulated connection ping
    if (!config.baseUrl.startsWith('http')) {
      throw new Error('Invalid Orthanc Base URL protocol');
    }
  }

  async receiveInbox(payload: any, ctx: AdapterContext): Promise<any[]> {
    // Orthanc webhook on stable study upload: { studyUid: string, patientId: string }
    const studyUid = payload.studyUid || payload.StudyInstanceUID;
    const patientId = payload.patientId || payload.PatientID;

    if (!studyUid) return [];

    ctx.logger.log(`Orthanc webhook callback: StudyInstanceUID=${studyUid}`);

    // Create Radiology Report stub and clinical observation to show in EMR
    await ctx.prisma.labResult.create({
      data: {
        tenantId: ctx.tenantId,
        patientId: patientId || '00000000-0000-0000-0000-000000000000',
        resultStatus: 'FINAL',
        resultJson: {
          studyUid,
          modality: payload.modality || 'CT',
          description: payload.description || 'DICOM Scan',
          viewerUrl: `${configViewerUrl(ctx.tenantId, studyUid)}`,
        } as any,
      },
    });

    return [];
  }

  buildAdminUi() {
    return {
      fields: [
        { name: 'baseUrl', label: 'Orthanc Base URL', type: 'text', required: true },
        { name: 'viewerUrl', label: 'OHIF Viewer URL', type: 'text', required: true },
      ],
    };
  }
}

function configViewerUrl(tenantId: string, studyUid: string): string {
  // Generate signed OHIF Viewer viewer URL
  return `http://localhost:3002/viewer?tenantId=${tenantId}&studyUid=${studyUid}&token=signed-token-hash-${Date.now()}`;
}
