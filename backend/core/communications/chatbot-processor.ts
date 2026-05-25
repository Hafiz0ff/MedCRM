import { randomUUID } from 'crypto';
import { PrismaService } from '@core/database/prisma.service';
import { QueueNames } from '@core/queue/queue-names';
import { QueueService } from '@core/queue/queue.module';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class ChatbotProcessor {
  private readonly logger = new Logger(ChatbotProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
  ) {}

  /**
   * Processes an incoming message from a patient and returns the bot's response text.
   * If a state transition occurred (e.g. appointment confirmed/cancelled), it performs it in the DB.
   */
  async processIncomingMessage(
    tenantId: string,
    patientId: string,
    messageText: string,
  ): Promise<string> {
    const text = messageText.trim().toLowerCase();
    this.logger.log(`Chatbot processing message from patient ${patientId}: "${text}"`);

    // 1. Process CONFIRM intent (/yes, да, подтверждаю)
    if (text.startsWith('/yes') || text === 'да' || text === 'подтверждаю') {
      const activeApp = await this.prisma.appointment.findFirst({
        where: {
          tenantId,
          patientId,
          status: 'SCHEDULED',
          startAt: { gt: new Date() },
        },
        orderBy: { startAt: 'asc' },
      });

      if (!activeApp) {
        return 'У вас нет предстоящих записей, ожидающих подтверждения.';
      }

      await this.prisma.$transaction(async (tx) => {
        await tx.appointment.update({
          where: { id: activeApp.id },
          data: { status: 'CONFIRMED' },
        });

        await tx.appointmentStatusHistory.create({
          data: {
            tenantId,
            appointmentId: activeApp.id,
            oldStatus: 'SCHEDULED',
            newStatus: 'CONFIRMED',
            reason: 'Patient chatbot reply "/yes"',
            changedBy: randomUUID(),
          },
        });
      });

      return `Ваша запись на прием ${activeApp.appointmentNumber} успешно подтверждена. Ждем вас!`;
    }

    // 2. Process CANCEL intent (/no, нет, отменить)
    if (text.startsWith('/no') || text === 'нет' || text === 'отменить') {
      const activeApp = await this.prisma.appointment.findFirst({
        where: {
          tenantId,
          patientId,
          status: { in: ['SCHEDULED', 'CONFIRMED'] },
          startAt: { gt: new Date() },
        },
        orderBy: { startAt: 'asc' },
      });

      if (!activeApp) {
        return 'Предстоящих записей для отмены не найдено.';
      }

      await this.prisma.$transaction(async (tx) => {
        await tx.appointment.update({
          where: { id: activeApp.id },
          data: { status: 'CANCELLED' },
        });

        await tx.appointmentStatusHistory.create({
          data: {
            tenantId,
            appointmentId: activeApp.id,
            oldStatus: activeApp.status,
            newStatus: 'CANCELLED',
            reason: 'Patient chatbot reply "/no"',
            changedBy: randomUUID(),
          },
        });
      });

      return `Ваша запись ${activeApp.appointmentNumber} успешно отменена. Надеемся увидеть вас в другой раз!`;
    }

    // 3. Process RESCHEDULE intent (/reschedule, перенос)
    if (text.startsWith('/reschedule') || text.includes('перенос') || text.includes('перенести')) {
      const activeApp = await this.prisma.appointment.findFirst({
        where: {
          tenantId,
          patientId,
          status: { in: ['SCHEDULED', 'CONFIRMED', 'NO_SHOW'] },
        },
        orderBy: { startAt: 'desc' },
      });

      if (!activeApp) {
        return 'Чтобы перенести запись, сначала необходимо иметь активную или пропущенную запись.';
      }

      // Propose three mock slots for tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowDateStr = tomorrow.toLocaleDateString('ru-RU');

      return (
        `Доступные слоты для переноса к вашему врачу на завтра (${tomorrowDateStr}):\n\n` +
        `1. В 10:00\n` +
        `2. В 14:00\n` +
        `3. В 16:00\n\n` +
        `Для подтверждения выбранного времени, пожалуйста, позвоните в регистратуру клиники. Мы с радостью вам поможем!`
      );
    }

    // 4. Default fallback answer
    return 'Ваше сообщение получено. С вами свяжется оператор регистратуры, если потребуется уточнение.';
  }
}
