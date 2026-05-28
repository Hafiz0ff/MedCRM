import { createHash, randomUUID } from 'node:crypto';
import { ZodValidationPipe } from '@core/common/zod-validation.pipe';
import { PrismaService } from '@core/database/prisma.service';
import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Req,
  UseGuards,
  UsePipes,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CombinedAuthGuard } from '../core/combined-auth.guard';
import {
  CreateLabOrderSchema,
  CreateLabOrderDto,
  UploadFileMetadataSchema,
  UploadFileMetadataDto,
  DeviceMeasurementSchema,
  DeviceMeasurementDto,
} from './dto/integration.dto';

@ApiTags('integration-gateway')
@ApiBearerAuth()
@UseGuards(CombinedAuthGuard)
@Controller('integration')
export class IntegrationGatewayController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('lab-orders')
  @UsePipes(new ZodValidationPipe(CreateLabOrderSchema))
  async createLabOrder(@Req() req: any, @Body() dto: CreateLabOrderDto) {
    const tenantId = req.user.tenantId;
    const userId = req.user.userId || '00000000-0000-0000-0000-000000000000';

    const provider = dto.providerId
      ? await this.prisma.laboratoryProvider.findFirst({
          where: { tenantId, id: dto.providerId },
        })
      : await this.prisma.laboratoryProvider.findFirst({
          where: { tenantId, isActive: true },
        });

    if (!provider) throw new BadRequestException('Активный лабораторный провайдер не найден');

    const order = await this.prisma.$transaction(async (tx) => {
      const dbOrder = await tx.labOrder.create({
        data: {
          tenantId,
          patientId: dto.patientId,
          encounterId: dto.encounterId,
          providerId: provider.id,
          priority: dto.priority,
          orderedBy: userId,
          orderStatus: 'CREATED',
        },
      });

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

    const hl7Payload = `MSH|^~\\&|MedCRM|${tenantId}|LIS|${provider.providerCode}|${Date.now()}||ORM^O01||P|2.3\nORC|NW|${order.id}|||||${dto.priority}\nOBR|1|${order.id}||${dto.items.map((i) => i.testCode).join('^')}`;

    const updatedOrder = await this.prisma.labOrder.update({
      where: { id: order.id },
      data: {
        orderStatus: 'SENT',
        externalOrderId: `LIS-${provider.providerCode}-${Date.now()}`,
      },
      include: { items: true },
    });

    return updatedOrder;
  }

  @Post('files/upload')
  @UsePipes(new ZodValidationPipe(UploadFileMetadataSchema))
  async registerFileMetadata(@Req() req: any, @Body() dto: UploadFileMetadataDto) {
    const tenantId = req.user.tenantId;
    const userId = req.user.userId || '00000000-0000-0000-0000-000000000000';

    const activeStorage = await this.prisma.storageProvider.findFirst({
      where: { tenantId, isActive: true },
    });
    if (!activeStorage)
      throw new BadRequestException('Активное облачное хранилище S3/MinIO не найдено');

    const fileId = randomUUID();
    const objectKey = `${tenantId}/${dto.patientId || 'anonymous'}/${dto.fileCategory.toLowerCase()}/${fileId}.${dto.extension}`;

    const file = await this.prisma.file.create({
      data: {
        id: fileId,
        tenantId,
        patientId: dto.patientId || null,
        encounterId: dto.encounterId || null,
        labResultId: dto.labResultId || null,
        uploadedBy: userId,
        storageProviderId: activeStorage.id,
        fileCategory: dto.fileCategory,
        fileName: dto.fileName,
        mimeType: dto.mimeType,
        extension: dto.extension,
        fileSize: dto.fileSize,
        objectKey,
      },
    });

    const preSignedUploadUrl = `${activeStorage.endpointUrl}/${activeStorage.bucketName}/${objectKey}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=900&X-Amz-Signature=mock-signature-hash-v4-${randomUUID()}`;

    return { file, uploadUrl: preSignedUploadUrl };
  }

  @Get('files/:id/download')
  async getExpiringDownloadUrl(@Req() req: any, @Param('id') fileId: string) {
    const tenantId = req.user.tenantId;

    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
    });
    if (!file) throw new NotFoundException('Файл не найден');
    if (file.tenantId !== tenantId) throw new ForbiddenException();

    const storage = await this.prisma.storageProvider.findUnique({
      where: { id: file.storageProviderId },
    });
    if (!storage) throw new NotFoundException('Хранилище файла не найдено');

    const downloadUrl = `${storage.endpointUrl}/${storage.bucketName}/${file.objectKey}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=900&X-Amz-Signature=mock-read-signature-${randomUUID()}`;

    return { file, downloadUrl };
  }

  @Post('devices/measurements')
  @UsePipes(new ZodValidationPipe(DeviceMeasurementSchema))
  async recordDeviceMeasurement(@Req() req: any, @Body() dto: DeviceMeasurementDto) {
    const tenantId = req.user.tenantId;

    const device = await this.prisma.medicalDevice.findUnique({
      where: { id: dto.deviceId },
    });
    if (!device || device.tenantId !== tenantId) {
      throw new BadRequestException('Указанный медицинский прибор не найден');
    }

    const data = dto.measurementData as Record<string, string>;

    const result = await this.prisma.$transaction(async (tx) => {
      const dbMeas = await tx.deviceMeasurement.create({
        data: {
          tenantId,
          patientId: dto.patientId,
          encounterId: dto.encounterId || null,
          deviceId: dto.deviceId,
          measurementType: dto.measurementType,
          measurementDataJson: dto.measurementData as any,
        },
      });

      await tx.clinicalObservation.create({
        data: {
          tenantId,
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

    return result;
  }
}
