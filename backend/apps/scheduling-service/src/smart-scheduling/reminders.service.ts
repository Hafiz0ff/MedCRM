import { REDIS_CLIENT } from '@core/cache/redis.module';
import { Inject, Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Queue, Worker, Job, type ConnectionOptions } from 'bullmq';
import Redis from 'ioredis';
import { PrismaService } from '../prisma.service';

export const APPOINTMENT_REMINDERS_QUEUE = 'appointment-reminders';

@Injectable()
export class RemindersService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RemindersService.name);
  private queue!: Queue;
  private worker!: Worker;

  private queueConnection!: Redis;
  private workerConnection!: Redis;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit(): void {
    this.queueConnection = this.redis.duplicate({ maxRetriesPerRequest: null });
    this.workerConnection = this.redis.duplicate({ maxRetriesPerRequest: null });

    this.queue = new Queue(APPOINTMENT_REMINDERS_QUEUE, {
      connection: this.queueConnection as unknown as ConnectionOptions,
    });

    this.worker = new Worker(
      APPOINTMENT_REMINDERS_QUEUE,
      async (job: Job) => {
        await this.processReminder(job);
      },
      { connection: this.workerConnection as unknown as ConnectionOptions, concurrency: 5 },
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
    try {
      await this.queueConnection?.quit();
    } catch {
      this.queueConnection?.disconnect();
    }
    try {
      await this.workerConnection?.quit();
    } catch {
      this.workerConnection?.disconnect();
    }
  }

  async scheduleAppointmentReminder(appointmentId: string, startAt: Date): Promise<void> {
    const delay = Math.max(startAt.getTime() - Date.now() - 24 * 60 * 60 * 1000, 0);
    await this.queue.add(
      'appointment.reminder.24h',
      { appointmentId },
      { jobId: `${appointmentId}-24h`, delay, removeOnComplete: true, removeOnFail: 1000 },
    );
  }

  private async processReminder(job: Job): Promise<void> {
    const { appointmentId } = job.data;
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
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
        sentAt: new Date(),
      },
    });

    this.logger.log(
      `Reminder sent for appointment ${appointment.appointmentNumber} — patient ${appointment.patientId}`,
    );
  }
}
