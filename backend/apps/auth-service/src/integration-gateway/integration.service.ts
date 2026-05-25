import { createHash } from 'crypto';
import { AuditLoggerService } from '@core/audit/audit-logger.service';
import { PrismaService } from '@core/database/prisma.service';
import { AuthenticatedUser } from '@core/security/jwt-payload';
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import {
  CreateLabOrderDto,
  SubmitLabResultDto,
  UploadFileMetadataDto,
  CallEventWebhookDto,
  DeviceMeasurementDto,
} from './dto/integration.dto';

@Injectable()
export class IntegrationGatewayService {
  private readonly logger = new Logger(IntegrationGatewayService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLoggerService,
  ) {}

  // 1. API Gateway Webhook Logging & Throttling
  async logIntegrationTransaction(
    tenantId: string,
    providerCode: string,
    direction: 'INBOUND' | 'OUTBOUND',
    reqPayload: any,
    resPayload: any,
    statusCode: number,
    execTime: number,
    correlationId?: string,
  ) {
    const provider = await this.prisma.integrationProvider.findFirst({
      where: { tenantId, providerCode },
    });

    return this.prisma.integrationLog.create({
      data: {
        tenantId,
        providerId: provider?.id || null,
        direction,
        requestPayload: reqPayload as any,
        responsePayload: resPayload as any,
        statusCode,
        executionTimeMs: execTime,
        correlationId: correlationId || null,
      },
    });
  }

  async handleIncomingWebhook(
    tenantId: string,
    providerCode: string,
    webhookType: string,
    headers: any,
    payload: any,
    signature?: string,
  ) {
    const provider = await this.prisma.integrationProvider.findFirst({
      where: { tenantId, providerCode, isActive: true },
    });
    if (!provider) throw new BadRequestException('Активный интеграционный провайдер не найден');

    // 1. Signature HMAC Verification (Simulation)
    if (provider.authenticationType === 'HMAC' && signature) {
      const config = provider.configurationJson as Record<string, string>;
      const secret = config.secret || 'secret-123';
      const computedHash = createHash('sha256')
        .update(JSON.stringify(payload) + secret)
        .digest('hex');
      if (computedHash !== signature) {
        throw new ForbiddenException('Подпись вебхука не прошла HMAC-валидацию');
      }
    }

    // 2. Log Webhook Event
    const event = await this.prisma.webhookEvent.create({
      data: {
        tenantId,
        providerId: provider.id,
        webhookType,
        externalEventId: payload.eventId || payload.id || null,
        requestHeadersJson: headers as any,
        payloadJson: payload as any,
        processingStatus: 'RECEIVED',
      },
    });

    await this.logIntegrationTransaction(
      tenantId,
      providerCode,
      'INBOUND',
      payload,
      { status: 'ACCEPTED', eventId: event.id },
      202,
      15,
    );

    return event;
  }

  // 2. LIS Laboratory Integrations & FHIR Transformations
  async createLabOrder(user: AuthenticatedUser, dto: CreateLabOrderDto) {
    const provider = dto.providerId
      ? await this.prisma.laboratoryProvider.findFirst({
          where: { tenantId: user.tenantId, id: dto.providerId },
        })
      : await this.prisma.laboratoryProvider.findFirst({
          where: { tenantId: user.tenantId, isActive: true },
        });

    if (!provider) throw new BadRequestException('Активный лабораторный провайдер не найден');

    const correlationId = crypto.randomUUID();

    const order = await this.prisma.$transaction(async (tx) => {
      const dbOrder = await tx.labOrder.create({
        data: {
          tenantId: user.tenantId,
          patientId: dto.patientId,
          encounterId: dto.encounterId,
          providerId: provider.id,
          priority: dto.priority,
          orderedBy: user.userId,
          orderStatus: 'CREATED',
        },
      });

      // Bulk create items
      await tx.labOrderItem.createMany({
        data: dto.items.map((item) => ({
          labOrderId: dbOrder.id,
          testCode: item.testCode,
          testName: item.testName,
          loincCode: item.loincCode || null,
          sampleType: item.sampleType || null,
          status: 'PENDING',
        })),
      });

      return dbOrder;
    });

    // Simulate sending order payloads out to LIS (HL7 v2.x Message)
    const hl7Payload = `MSH|^~\\&|MedCRM|${user.tenantId}|LIS|${provider.providerCode}|${Date.now()}||ORM^O01||P|2.3\nORC|NW|${order.id}|||||${dto.priority}\nOBR|1|${order.id}||${dto.items.map((i) => i.testCode).join('^')}`;
    this.logger.debug(`Generated outbound HL7 ORM message:\n${hl7Payload}`);

    // Update Status to SENT
    const updatedOrder = await this.prisma.labOrder.update({
      where: { id: order.id },
      data: {
        orderStatus: 'SENT',
        externalOrderId: `LIS-${provider.providerCode}-${Date.now()}`,
      },
      include: { items: true },
    });

    await this.logIntegrationTransaction(
      user.tenantId,
      provider.providerCode,
      'OUTBOUND',
      { order: updatedOrder, rawHl7: hl7Payload },
      { status: 'SENT_SUCCESS', code: 200 },
      200,
      45,
      correlationId,
    );

    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.userId,
      action: 'lab_order.sent',
      entityType: 'lab_order',
      entityId: order.id,
      newValuesJson: updatedOrder as any,
    });

    return updatedOrder;
  }

  async submitLabResult(tenantId: string, providerCode: string, dto: SubmitLabResultDto) {
    const provider = await this.prisma.laboratoryProvider.findFirst({
      where: { tenantId, providerCode },
    });
    if (!provider) throw new NotFoundException('Лабораторный провайдер не найден');

    // Find the linked order
    const order = await this.prisma.labOrder.findFirst({
      where: { tenantId, externalOrderId: dto.externalOrderId },
      include: { items: true },
    });
    if (!order) throw new NotFoundException(`Лабораторный заказ ${dto.externalOrderId} не найден`);

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Create LabResult
      const dbResult = await tx.labResult.create({
        data: {
          tenantId,
          patientId: order.patientId,
          encounterId: order.encounterId,
          labOrderId: order.id,
          externalResultId: dto.externalResultId,
          resultStatus: dto.resultStatus,
          resultJson: dto.results as any,
          abnormalFlagsJson: dto.abnormalFlagsJson as any,
        },
      });

      // 2. Convert results into Clinical Observations (FHIR interoperability)
      for (const obs of dto.results) {
        await tx.clinicalObservation.create({
          data: {
            tenantId,
            patientId: order.patientId,
            encounterId: order.encounterId,
            observationCode: obs.testCode,
            observationName: obs.testName,
            value: obs.value,
            unit: obs.unit || null,
            referenceRange: obs.referenceRange || null,
            abnormalFlag: obs.abnormalFlag || null,
            sourceProviderId: provider.id,
            labResultId: dbResult.id,
          },
        });
      }

      // 3. Mark Order as COMPLETED
      await tx.labOrder.update({
        where: { id: order.id },
        data: {
          orderStatus: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      await tx.labOrderItem.updateMany({
        where: { labOrderId: order.id },
        data: { status: 'COMPLETED' },
      });

      return dbResult;
    });

    // Notify clinic staff via audit logger
    await this.audit.log({
      tenantId,
      userId: order.orderedBy,
      action: 'lab_result.received',
      entityType: 'lab_result',
      entityId: result.id,
      newValuesJson: result as any,
    });

    return result;
  }

  // 3. S3 Cloud Storage Subsystem
  async registerFileMetadata(user: AuthenticatedUser, dto: UploadFileMetadataDto) {
    const activeStorage = await this.prisma.storageProvider.findFirst({
      where: { tenantId: user.tenantId, isActive: true },
    });
    if (!activeStorage)
      throw new BadRequestException('Активное облачное хранилище S3/MinIO не найдено');

    const fileId = crypto.randomUUID();
    const objectKey = `${user.tenantId}/${dto.patientId || 'anonymous'}/${dto.fileCategory.toLowerCase()}/${fileId}.${dto.extension}`;

    const file = await this.prisma.file.create({
      data: {
        id: fileId,
        tenantId: user.tenantId,
        patientId: dto.patientId || null,
        encounterId: dto.encounterId || null,
        labResultId: dto.labResultId || null,
        uploadedBy: user.userId,
        storageProviderId: activeStorage.id,
        fileCategory: dto.fileCategory,
        fileName: dto.fileName,
        mimeType: dto.mimeType,
        extension: dto.extension,
        fileSize: dto.fileSize,
        objectKey,
      },
    });

    // Generate simulated expiring pre-signed upload URL (AWS S3 Signature V4 replica)
    const preSignedUploadUrl = `${activeStorage.endpointUrl}/${activeStorage.bucketName}/${objectKey}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=900&X-Amz-Signature=mock-signature-hash-v4-${crypto.randomUUID()}`;

    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.userId,
      action: 'file.uploaded',
      entityType: 'file',
      entityId: file.id,
      newValuesJson: file as any,
    });

    return { file, uploadUrl: preSignedUploadUrl };
  }

  async getExpiringDownloadUrl(user: AuthenticatedUser, fileId: string) {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
    });
    if (!file) throw new NotFoundException('Файл не найден');
    if (file.tenantId !== user.tenantId) throw new ForbiddenException();

    const storage = await this.prisma.storageProvider.findUnique({
      where: { id: file.storageProviderId },
    });
    if (!storage) throw new NotFoundException('Хранилище файла не найдено');

    // Generate pre-signed URL valid for 15 minutes (900 seconds)
    const downloadUrl = `${storage.endpointUrl}/${storage.bucketName}/${file.objectKey}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=900&X-Amz-Signature=mock-read-signature-${crypto.randomUUID()}`;

    return { file, downloadUrl };
  }

  // 4. IP Telephony Integration Layer
  async processTelephonyWebhook(tenantId: string, dto: CallEventWebhookDto) {
    const provider = await this.prisma.telephonyProvider.findFirst({
      where: { tenantId, providerCode: dto.providerCode, isActive: true },
    });
    if (!provider) throw new NotFoundException('Провайдер телефонии не найден');

    // Caller Resolver: Find patient in CRM database by phone hashes
    const phoneHash = createHash('sha256')
      .update(dto.phone.toLowerCase().replace(/[\s()+-]/g, ''))
      .digest('hex');

    const contact = await this.prisma.patientContact.findFirst({
      where: { tenantId, normalizedValueHash: phoneHash },
    });

    let recordingFileId: string | null = null;

    // Simulate downloading recording audio file and storing in isolated S3 bucket
    if (dto.eventType === 'RECORDING_READY' && dto.recordingUrl) {
      const storage = await this.prisma.storageProvider.findFirst({
        where: { tenantId, isActive: true },
      });
      if (storage) {
        const fileId = crypto.randomUUID();
        const objectKey = `${tenantId}/${contact?.patientId || 'telephony'}/audio_call/${fileId}.mp3`;
        const file = await this.prisma.file.create({
          data: {
            id: fileId,
            tenantId,
            patientId: contact?.patientId || null,
            uploadedBy: '00000000-0000-0000-0000-000000000000', // System Bot
            storageProviderId: storage.id,
            fileCategory: 'AUDIO_CALL',
            fileName: `CallRecord-${dto.callId}.mp3`,
            mimeType: 'audio/mpeg',
            extension: 'mp3',
            fileSize: 450000, // 450 KB mock size
            objectKey,
          },
        });
        recordingFileId = file.id;

        await this.audit.log({
          tenantId,
          userId: '00000000-0000-0000-0000-000000000000',
          action: 'call.recording.saved',
          entityType: 'file',
          entityId: file.id,
          newValuesJson: file as any,
        });
      }
    }

    const callEvent = await this.prisma.callEvent.create({
      data: {
        tenantId,
        providerId: provider.id,
        callId: dto.callId,
        patientId: contact?.patientId || null,
        eventType: dto.eventType,
        phoneNumber: dto.phone,
        direction: dto.direction,
        durationSeconds: dto.durationSeconds || 0,
        recordingFileId,
      },
    });

    await this.logIntegrationTransaction(
      tenantId,
      dto.providerCode,
      'INBOUND',
      dto,
      { ok: true, callEventId: callEvent.id },
      200,
      25,
    );

    return callEvent;
  }

  // 5. Medical Device Measurements Telemetry normalizer
  async recordDeviceMeasurement(user: AuthenticatedUser, dto: DeviceMeasurementDto) {
    const device = await this.prisma.medicalDevice.findUnique({
      where: { id: dto.deviceId },
    });
    if (!device || device.tenantId !== user.tenantId) {
      throw new BadRequestException('Указанный медицинский прибор не найден');
    }

    const data = dto.measurementData as Record<string, string>;

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Log Raw measurement telemetry
      const dbMeas = await tx.deviceMeasurement.create({
        data: {
          tenantId: user.tenantId,
          patientId: dto.patientId,
          encounterId: dto.encounterId || null,
          deviceId: dto.deviceId,
          measurementType: dto.measurementType,
          measurementDataJson: dto.measurementData as any,
        },
      });

      // 2. Normalize and create EMR clinical observation for direct EMR display!
      await tx.clinicalObservation.create({
        data: {
          tenantId: user.tenantId,
          patientId: dto.patientId,
          encounterId: dto.encounterId || null,
          observationCode: dto.measurementType.toUpperCase(),
          observationName: `${device.manufacturer} ${device.model} measurement`,
          value: data.value || '0',
          unit: data.unit || null,
          sourceProviderId: device.id,
        },
      });

      return dbMeas;
    });

    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.userId,
      action: 'device.measurement.received',
      entityType: 'device_measurement',
      entityId: result.id,
      newValuesJson: result as any,
    });

    return result;
  }

  // Terminology and terminological FHIR diagnostics resources mapping
  async getDiagnosticReportFHIR(user: AuthenticatedUser, labResultId: string) {
    const result = await this.prisma.labResult.findUnique({
      where: { id: labResultId },
      include: {
        patient: true,
        order: { include: { provider: true } },
        observations: true,
      },
    });

    if (!result) throw new NotFoundException('Лабораторный результат не найден');
    if (result.tenantId !== user.tenantId) throw new ForbiddenException();

    // FHIR Interoperability transform DiagnosticReport payload
    return {
      resourceType: 'DiagnosticReport',
      id: result.id,
      status: result.resultStatus === 'FINAL' ? 'final' : 'partial',
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v2-0074',
              code: 'LAB',
              display: 'Laboratory',
            },
          ],
        },
      ],
      code: {
        coding: [{ system: 'http://loinc.org', code: '11502-2', display: 'Laboratory report' }],
      },
      subject: {
        reference: `Patient/${result.patientId}`,
        display: result.patient.fullName,
      },
      effectiveDateTime: result.receivedAt.toISOString(),
      issued: result.receivedAt.toISOString(),
      performer: [
        {
          reference: `Organization/${result.order?.providerId}`,
          display: result.order?.provider?.providerName || 'LIS Laboratory',
        },
      ],
      result: result.observations.map((obs) => ({
        reference: `Observation/${obs.id}`,
        display: obs.observationName,
      })),
    };
  }

  async getObservationFHIR(user: AuthenticatedUser, observationId: string) {
    const obs = await this.prisma.clinicalObservation.findUnique({
      where: { id: observationId },
      include: { patient: true },
    });

    if (!obs) throw new NotFoundException('Клиническое наблюдение не найдено');
    if (obs.tenantId !== user.tenantId) throw new ForbiddenException();

    return {
      resourceType: 'Observation',
      id: obs.id,
      status: 'final',
      code: {
        coding: [
          { system: 'http://loinc.org', code: obs.observationCode, display: obs.observationName },
        ],
      },
      subject: {
        reference: `Patient/${obs.patientId}`,
        display: obs.patient.fullName,
      },
      encounter: obs.encounterId ? { reference: `Encounter/${obs.encounterId}` } : undefined,
      effectiveDateTime: obs.observedAt.toISOString(),
      valueQuantity: {
        value: Number(obs.value) || obs.value,
        unit: obs.unit || undefined,
        system: obs.unit ? 'http://unitsofmeasure.org' : undefined,
      },
      interpretation: obs.abnormalFlag
        ? [
            {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
                  code: obs.abnormalFlag,
                },
              ],
            },
          ]
        : undefined,
      referenceRange: obs.referenceRange
        ? [
            {
              text: obs.referenceRange,
            },
          ]
        : undefined,
    };
  }
}
