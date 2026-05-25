import { randomUUID } from 'crypto';
import { REDIS_CLIENT } from '@core/cache/redis.module';
import { PrismaService } from '@core/database/prisma.service';
import { QueueNames } from '@core/queue/queue-names';
import { QueueService } from '@core/queue/queue.module';
import { Injectable, OnModuleInit, Logger, Inject } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';

type NoShowPayload = {
  tenantId: string;
  appointmentId: string;
};

@Injectable()
export class NoShowFollowupWorker implements OnModuleInit {
  private readonly logger = new Logger(NoShowFollowupWorker.name);
  private worker!: Worker<NoShowPayload>;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
  ) {}

  onModuleInit() {
    const connection = this.redis.duplicate({ maxRetriesPerRequest: null });

    this.worker = new Worker<NoShowPayload>(
      QueueNames.APPOINTMENTS_NO_SHOW,
      async (job: Job<NoShowPayload>) => {
        await this.handleNoShow(job);
      },
      { connection, concurrency: 10 },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.warn(`No-show follow-up job ${job?.id} failed: ${err.message}`);
    });
  }

  private async handleNoShow(job: Job<NoShowPayload>): Promise<any> {
    const { tenantId, appointmentId } = job.data;

    return await this.prisma.$transaction(async (tx) => {
      const app = await tx.appointment.findFirst({
        where: { id: appointmentId, tenantId },
        include: {
          patient: { include: { contacts: true } },
          employee: true,
        },
      });

      if (!app) {
        return { status: 'SKIPPED', reason: 'Appointment not found' };
      }

      // Only transition to NO_SHOW if currently in SCHEDULED state (meaning patient never checked-in)
      if (app.status !== 'SCHEDULED' && app.status !== 'NO_SHOW') {
        return {
          status: 'SKIPPED',
          reason: `Appointment is in state ${app.status}, skip followup`,
        };
      }

      this.logger.log(
        `Processing no-show follow-up for appointment ${app.appointmentNumber} (Patient: ${app.patientId})...`,
      );

      // 1. Transition appointment status to NO_SHOW in database if not already
      if (app.status === 'SCHEDULED') {
        await tx.appointment.update({
          where: { id: app.id },
          data: { status: 'NO_SHOW' },
        });

        // Log status history transition
        await tx.appointmentStatusHistory.create({
          data: {
            tenantId,
            appointmentId: app.id,
            oldStatus: 'SCHEDULED',
            newStatus: 'NO_SHOW',
            reason: 'Automated system 30m no-show scanner',
            changedBy: randomUUID(), // system bot ID
          },
        });
      }

      // 2. Identify preferred channel based on contacts
      const hasTelegram = app.patient?.contacts.some((c) => c.type.toUpperCase() === 'TELEGRAM');
      const channelType = hasTelegram ? 'TELEGRAM' : 'SMS';

      // 3. Find or Create default message template for NO_SHOW_FOLLOWUP
      let template = await tx.messageTemplate.findFirst({
        where: {
          tenantId,
          templateCode: 'NO_SHOW_FOLLOWUP',
          isActive: true,
        },
      });

      if (!template) {
        template = await tx.messageTemplate.create({
          data: {
            tenantId,
            templateCode: 'NO_SHOW_FOLLOWUP',
            templateName: 'No-Show Follow-up',
            channelType,
            templateBody:
              'Мы не дождались Вас на прием. Хотите перенести? Напишите /reschedule для выбора другого свободного времени.',
            isSystem: true,
            isActive: true,
          },
        });
      }

      // 4. Initialize active Patient Conversation session
      let conversation = await tx.conversation.findFirst({
        where: {
          tenantId,
          patientId: app.patientId,
          primaryChannel: channelType,
        },
      });

      if (!conversation) {
        conversation = await tx.conversation.create({
          data: {
            tenantId,
            patientId: app.patientId,
            primaryChannel: channelType,
            conversationStatus: 'OPEN',
          },
        });
      }

      // 5. Build outbound message text (usually template-compiled)
      const messageText =
        'Мы не дождались Вас на прием. Хотите перенести? Напишите /reschedule для выбора другого свободного времени.';

      // 6. Write bot message to chat logs
      const botId = randomUUID();
      await tx.message.create({
        data: {
          tenantId,
          conversationId: conversation.id,
          patientId: app.patientId,
          senderType: 'BOT',
          senderId: botId,
          channelType,
          direction: 'OUTBOUND',
          messageType: 'TEXT',
          messageText,
        },
      });

      // 7. Queue actual dispatch job in the notifications dispatcher queue
      const nq = await tx.notificationsQueue.create({
        data: {
          tenantId,
          patientId: app.patientId,
          appointmentId: app.id,
          channelType,
          templateId: template.id,
          scheduledAt: new Date(),
          deliveryStatus: 'PENDING',
          priority: 'MEDIUM',
        },
      });

      await this.queueService.addJob(
        QueueNames.NOTIFICATIONS_DISPATCH,
        `dispatch-${nq.id}`,
        {
          tenantId,
          queueRecordId: nq.id,
        },
        nq.id,
      );

      this.logger.log(
        `No-show follow-up successfully generated and enqueued for dispatch (Appointment: ${app.appointmentNumber}).`,
      );
      return { status: 'PROCESSED', appointmentId: app.id };
    });
  }
}
