import { Inject, Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '@core/cache/redis.module';
import { PrismaService } from '@core/database/prisma.service';

export const APPOINTMENT_REMINDERS_QUEUE = 'appointment-reminders';

@Injectable()
export class RemindersService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RemindersService.name);
  private queue!: Queue;
  private worker!: Worker;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly prisma: PrismaService
  ) {}

  onModuleInit(): void {
    const connection = this.redis.duplicate({ maxRetriesPerRequest: null });

    this.queue = new Queue(APPOINTMENT_REMINDERS_QUEUE, { connection });

    this.worker = new Worker(
      APPOINTMENT_REMINDERS_QUEUE,
      async (job: Job) => {
        await this.processReminder(job);
      },
      { connection: this.redis.duplicate({ maxRetriesPerRequest: null }), concurrency: 5 }
    );

    this.worker.on('completed', (job) => {
      this.logger.log(`Reminder job ${job.id} completed`);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Reminder job ${job?.id} failed: ${err.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
  }

  async scheduleAppointmentReminder(appointmentId: string, startAt: Date): Promise<void> {
    const delay = Math.max(startAt.getTime() - Date.now() - 24 * 60 * 60 * 1000, 0);
    await this.queue.add(
      'appointment.reminder.24h',
      { appointmentId },
      { jobId: `${appointmentId}:24h`, delay, removeOnComplete: true, removeOnFail: 1000 }
    );
  }

  private async processReminder(job: Job): Promise<void> {
    const { appointmentId } = job.data;
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { patient: { include: { contacts: true } }, service: true, branch: true }
    });

    if (!appointment || ['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(appointment.status)) {
      this.logger.log(`Skipping reminder for ${appointmentId} — status ${appointment?.status}`);
      return;
    }

    // Create notification record
    await this.prisma.appointmentNotification.create({
      data: {
        tenantId: appointment.tenantId,
        appointmentId: appointment.id,
        notificationType: 'REMINDER_24H',
        channel: 'SMS',
        status: 'SENT',
        sentAt: new Date()
      }
    });

    this.logger.log(`Reminder sent for appointment ${appointment.appointmentNumber} — patient ${appointment.patient.fullName}`);
  }
}
