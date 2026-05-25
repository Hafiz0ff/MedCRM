import { REDIS_CLIENT } from '@core/cache/redis.module';
import { PrismaService } from '@core/database/prisma.service';
import { QueueNames } from '@core/queue/queue-names';
import { QueueService } from '@core/queue/queue.module';
import { Injectable, OnModuleInit, Logger, Inject } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';

@Injectable()
export class NotificationsScheduleScanWorker implements OnModuleInit {
  private readonly logger = new Logger(NotificationsScheduleScanWorker.name);
  private worker!: Worker;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
  ) {}

  async onModuleInit() {
    const connection = this.redis.duplicate({ maxRetriesPerRequest: null });

    this.worker = new Worker(
      QueueNames.NOTIFICATIONS_SCHEDULE_SCAN_TRIGGER,
      async (job: Job) => {
        await this.scanUpcomingAppointments();
      },
      { connection, concurrency: 1 },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Schedule scan trigger job failed: ${err.message}`);
    });

    const queue = this.queueService.getQueue(QueueNames.NOTIFICATIONS_SCHEDULE_SCAN_TRIGGER);

    // Clear old repeatable schedules
    const schedulers = await queue.getRepeatableJobs();
    for (const s of schedulers) {
      await queue.removeRepeatableByKey(s.key);
    }

    await queue.add(
      'scan-appointments',
      {},
      {
        repeat: { every: 300000 }, // every 5 minutes
        removeOnComplete: true,
        removeOnFail: true,
      },
    );

    this.logger.log(
      'Notifications Schedule Scan Worker initialized. Scheduled 5m repeatable scanning.',
    );
  }

  /**
   * Scans all active appointments and schedules 24h & 2h reminders.
   */
  async scanUpcomingAppointments(): Promise<void> {
    const now = new Date();
    const horizon24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const horizon2h = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    const activeTenants = await this.prisma.tenant.findMany({
      where: { status: 'active' },
    });

    for (const tenant of activeTenants) {
      try {
        // Query appointments in the next 24 hours
        const appointments24h = await this.prisma.appointment.findMany({
          where: {
            tenantId: tenant.id,
            startAt: { gte: now, lte: horizon24h },
            status: { in: ['SCHEDULED', 'CONFIRMED'] },
          },
          include: {
            patient: { include: { contacts: true } },
          },
        });

        for (const app of appointments24h) {
          const hoursLeft = (app.startAt.getTime() - now.getTime()) / (1000 * 60 * 60);

          if (hoursLeft <= 2.0) {
            await this.checkAndCreateReminder(tenant.id, app, 'REMINDER_2H');
          } else {
            await this.checkAndCreateReminder(tenant.id, app, 'REMINDER_24H');
          }
        }
      } catch (err: any) {
        this.logger.error(`Failed to scan reminders for tenant ${tenant.id}: ${err.message}`);
      }
    }
  }

  private async checkAndCreateReminder(
    tenantId: string,
    appointment: any,
    reminderType: 'REMINDER_24H' | 'REMINDER_2H',
  ): Promise<void> {
    // Check if a reminder for this appointment and type has already been generated
    const exists = await this.prisma.notificationsQueue.findFirst({
      where: {
        tenantId,
        appointmentId: appointment.id,
        template: {
          templateCode: reminderType,
        },
      },
    });

    if (exists) {
      return;
    }

    // Find default message template for this rule type
    // If not found, try to locate a system fallback template or any matching template
    let template = await this.prisma.messageTemplate.findFirst({
      where: {
        tenantId,
        templateCode: reminderType,
        isActive: true,
      },
    });

    if (!template) {
      // Create seed/fallback template on the fly if missing to keep the system self-healing
      const templateName =
        reminderType === 'REMINDER_24H' ? '24h Appointment Reminder' : '2h Appointment Reminder';
      const templateBody =
        reminderType === 'REMINDER_24H'
          ? '{{patient.firstName}}, напоминаем: завтра в {{time appointment.startAt}} вас ждет прием. Подтвердить: /yes, Отменить: /no'
          : 'Напоминаем: через 2 часа у вас прием в {{clinic.name}} у врача {{doctor.lastName}}. Кабинет {{appointment.roomCode}}';

      template = await this.prisma.messageTemplate.create({
        data: {
          tenantId,
          templateCode: reminderType,
          templateName,
          channelType: 'TELEGRAM',
          templateBody,
          isSystem: true,
          isActive: true,
        },
      });
    }

    // Route channel type based on patient contacts availability (Telegram is preferred, fallback to SMS)
    const hasTelegram = appointment.patient?.contacts.some(
      (c: any) => c.type.toUpperCase() === 'TELEGRAM',
    );
    const channelType = hasTelegram ? 'TELEGRAM' : 'SMS';

    this.logger.log(
      `Generating ${reminderType} (${channelType}) for appointment ${appointment.appointmentNumber}...`,
    );

    // Write pending outbox message log to notifications_queue
    const nq = await this.prisma.notificationsQueue.create({
      data: {
        tenantId,
        patientId: appointment.patientId,
        appointmentId: appointment.id,
        channelType,
        templateId: template.id,
        scheduledAt: new Date(),
        deliveryStatus: 'PENDING',
        priority: 'MEDIUM',
      },
    });

    // Enqueue immediate dispatch job in the BullMQ dispatch queue
    await this.queueService.addJob(
      QueueNames.NOTIFICATIONS_DISPATCH,
      `dispatch-${nq.id}`,
      {
        tenantId,
        queueRecordId: nq.id,
      },
      nq.id,
    );
  }
}
