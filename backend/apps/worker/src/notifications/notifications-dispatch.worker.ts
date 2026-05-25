import { REDIS_CLIENT } from '@core/cache/redis.module';
import { ChannelProviderRegistry } from '@core/communications/channel-provider.registry';
import { PrismaService } from '@core/database/prisma.service';
import { QueueNames } from '@core/queue/queue-names';
import { QueueService } from '@core/queue/queue.module';
import { TemplateService } from '@core/templates/template.service';
import { Injectable, OnModuleInit, Logger, Inject } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';

type DispatchPayload = {
  tenantId: string;
  queueRecordId: string;
};

@Injectable()
export class NotificationsDispatchWorker implements OnModuleInit {
  private readonly logger = new Logger(NotificationsDispatchWorker.name);
  private worker!: Worker<DispatchPayload>;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
    private readonly templates: TemplateService,
    private readonly channels: ChannelProviderRegistry,
  ) {}

  onModuleInit() {
    const connection = this.redis.duplicate({ maxRetriesPerRequest: null });

    this.worker = new Worker<DispatchPayload>(
      QueueNames.NOTIFICATIONS_DISPATCH,
      async (job: Job<DispatchPayload>) => {
        await this.handleDispatch(job);
      },
      { connection, concurrency: 20 },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.warn(`Notification dispatch job ${job?.id} failed: ${err.message}`);
    });
  }

  private async handleDispatch(job: Job<DispatchPayload>): Promise<any> {
    const { tenantId, queueRecordId } = job.data;

    return await this.prisma.$transaction(async (tx) => {
      const rec = await tx.notificationsQueue.findFirst({
        where: { id: queueRecordId, tenantId },
        include: {
          patient: {
            include: { contacts: true },
          },
          template: true,
          appointment: {
            include: { employee: true },
          },
        },
      });

      if (!rec || rec.deliveryStatus !== 'PENDING') {
        return { status: 'SKIPPED', reason: 'Record not found or already processed' };
      }

      // 1. Quiet Hours Enforcement scoped to tenant local timezone (22:00 to 08:00)
      const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: tenantId } });
      const tz = tenant.timezone || 'Europe/Moscow';
      const now = new Date();

      const currentHour = parseInt(
        now.toLocaleTimeString('en-US', { timeZone: tz, hour12: false, hour: '2-digit' }),
        10,
      );
      const isQuietHours = currentHour >= 22 || currentHour < 8;

      if (isQuietHours && rec.priority !== 'HIGH') {
        let hoursToWait = 0;
        if (currentHour >= 22) {
          hoursToWait = 24 - currentHour + 8;
        } else {
          hoursToWait = 8 - currentHour;
        }

        const delayMs = hoursToWait * 60 * 60 * 1000;
        this.logger.log(
          `Quiet hours active (${currentHour}:00) in ${tz} for tenant ${tenantId}. Postponing dispatch by ${hoursToWait} hours...`,
        );

        // Postpone scheduledAt in DB
        const postponedDate = new Date(now.getTime() + delayMs);
        await tx.notificationsQueue.update({
          where: { id: rec.id },
          data: { scheduledAt: postponedDate },
        });

        // Re-enqueue delayed BullMQ job
        await this.queueService.addJob(
          QueueNames.NOTIFICATIONS_DISPATCH,
          `dispatch-${rec.id}`,
          { tenantId, queueRecordId },
          rec.id,
          delayMs,
        );

        return { status: 'POSTPONED', nextRun: postponedDate.toISOString() };
      }

      // 2. Fetch appropriate recipient address/phone/chatId from patient contacts
      const contactType = rec.channelType === 'TELEGRAM' ? 'TELEGRAM' : 'PHONE';
      const contact =
        rec.patient?.contacts.find((c) => c.type.toUpperCase() === contactType) ||
        rec.patient?.contacts[0];

      if (!contact || !contact.value) {
        this.logger.warn(
          `No valid contact found for patient ${rec.patientId} on channel ${rec.channelType}`,
        );
        await tx.notificationsQueue.update({
          where: { id: rec.id },
          data: {
            deliveryStatus: 'FAILED',
            processedAt: new Date(),
          },
        });
        return { status: 'FAILED', reason: 'Recipient contact details missing' };
      }

      // 3. Compile handlebars template variables
      const payload = {
        patient: {
          firstName: rec.patient?.firstName || '',
          lastName: rec.patient?.lastName || '',
          fullName: rec.patient?.fullName || '',
        },
        appointment: rec.appointment
          ? {
              startAt: rec.appointment.startAt.toISOString(),
              endAt: rec.appointment.endAt.toISOString(),
              appointmentNumber: rec.appointment.appointmentNumber,
            }
          : null,
        doctor: rec.appointment?.employee
          ? {
              firstName: rec.appointment.employee.firstName || '',
              lastName: rec.appointment.employee.lastName || '',
            }
          : null,
        clinic: {
          name: tenant.name,
        },
        ...(rec.payloadJson ? (rec.payloadJson as Record<string, any>) : {}),
      };

      const compiledBody = this.templates.compile(rec.template.templateBody, payload);
      const compiledSubject = rec.template.subject
        ? this.templates.compile(rec.template.subject, payload)
        : null;

      // 4. Invoke channel provider send call
      const provider = this.channels.get(rec.channelType);

      const result = await provider.send({
        to: contact.value,
        subject: compiledSubject,
        body: compiledBody,
        meta: { queueId: rec.id, appointmentId: rec.appointmentId },
      });

      // 5. Update queue log & audit entities
      await tx.notificationsQueue.update({
        where: { id: rec.id },
        data: {
          deliveryStatus: result.status,
          retryCount: { increment: 1 },
          processedAt: new Date(),
        },
      });

      if (rec.appointmentId) {
        await tx.appointmentNotification.create({
          data: {
            tenantId,
            appointmentId: rec.appointmentId,
            notificationType: rec.template.templateCode,
            channel: rec.channelType,
            status: result.status,
            sentAt: result.status === 'SENT' ? new Date() : null,
          },
        });
      }

      this.logger.log(
        `Notification ${rec.id} (${rec.channelType}) processed with status: ${result.status}`,
      );
      return result;
    });
  }
}
