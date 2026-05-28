import { PrismaService } from '@core/database/prisma.service';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class DigestProcessor {
  private readonly logger = new Logger(DigestProcessor.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Генерация ежедневного дайджеста для руководителя
   */
  async generateDailyDigest(tenantId: string): Promise<string> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Собираем финансовые агрегаты за вчера
    const yesterdayAggregate = await this.prisma.financialDailyAggregate.findFirst({
      where: {
        tenantId,
        aggregationDate: {
          gte: yesterday,
          lt: today,
        },
      },
    });

    // 2. Считаем приемы за вчера
    const apptsYesterday = await this.prisma.dwFactAppointment.findMany({
      where: {
        tenantId,
        appointmentDate: {
          gte: yesterday,
          lt: today,
        },
      },
    });

    const totalVisits = apptsYesterday.length;
    const completedVisits = apptsYesterday.filter((a) => a.completedFlag).length;
    const missedVisits = apptsYesterday.filter((a) => a.noShowFlag).length;

    const noShowRate = totalVisits > 0 ? ((missedVisits / totalVisits) * 100).toFixed(1) : '0';
    const revenue = yesterdayAggregate ? Number(yesterdayAggregate.totalRevenue) : 0;
    const avgCheck = yesterdayAggregate ? Number(yesterdayAggregate.averageCheck) : 0;

    // 3. Формируем красивое текстовое сообщение на русском языке
    let message = `📊 *Ежедневный дайджест клиники за ${yesterday.toLocaleDateString('ru-RU')}*\n\n`;
    message += `💰 *Выручка:* ${revenue.toLocaleString('ru-RU')} ₽\n`;
    message += `💳 *Средний чек:* ${avgCheck.toLocaleString('ru-RU')} ₽\n\n`;
    message += `👥 *Приёмы вчера:* ${totalVisits}\n`;
    message += `✅ *Завершено:* ${completedVisits}\n`;
    message += `❌ *Пропущено (No-show):* ${missedVisits} (${noShowRate}%)\n\n`;

    // 4. Планы на сегодня
    const apptsToday = await this.prisma.appointment.count({
      where: {
        tenantId,
        startAt: {
          gte: today,
          lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
        },
      },
    });

    message += `📅 *Запланировано на сегодня:* ${apptsToday} записей.\n\n`;
    message += `Желаем успешного рабочего дня! 🚀`;

    this.logger.log(`Дайджест сгенерирован для тенанта ${tenantId}`);
    return message;
  }

  /**
   * Обнаружение аномалий (Anomaly Detection)
   */
  async checkAnomalies(
    tenantId: string,
  ): Promise<{ isAnomaly: boolean; metric?: string; details?: string }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Загружаем статистику отмен за последние 14 дней
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const dailyStats = await this.prisma.dwFactAppointment.findMany({
      where: {
        tenantId,
        appointmentDate: {
          gte: fourteenDaysAgo,
          lt: today,
        },
      },
    });

    if (dailyStats.length === 0) {
      return { isAnomaly: false };
    }

    // Группируем по дням для расчета среднего и стандартного отклонения
    const cancellationRates: Record<string, number> = {};
    for (const stat of dailyStats) {
      const dayStr = stat.appointmentDate.toDateString();
      if (!cancellationRates[dayStr]) {
        cancellationRates[dayStr] = 0;
      }
      if (stat.appointmentStatus === 'CANCELLED') {
        cancellationRates[dayStr] += 1;
      }
    }

    const rates = Object.values(cancellationRates);
    if (rates.length < 3) {
      return { isAnomaly: false }; // Недостаточно данных
    }

    const mean = rates.reduce((sum, val) => sum + val, 0) / rates.length;
    const sqDiffs = rates.map((val) => Math.pow(val - mean, 2));
    const variance = sqDiffs.reduce((sum, val) => sum + val, 0) / sqDiffs.length;
    const stdDev = Math.sqrt(variance);

    // Вчерашние отмены
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const yesterdayCancelCount = dailyStats.filter(
      (a) =>
        a.appointmentStatus === 'CANCELLED' &&
        a.appointmentDate >= yesterday &&
        a.appointmentDate < today,
    ).length;

    // Проверка на аномалию: значение вчера превышает среднее более чем на 2.5 стандартных отклонения
    const threshold = mean + 2.5 * stdDev;
    const isAnomaly = yesterdayCancelCount > threshold && yesterdayCancelCount > 5;

    if (isAnomaly) {
      return {
        isAnomaly: true,
        metric: 'CANCELLATION_COUNT',
        details: `Вчера зафиксировано аномальное количество отмен: ${yesterdayCancelCount} при среднем значении в ${mean.toFixed(1)} (порог аномалии: ${threshold.toFixed(1)}).`,
      };
    }

    return { isAnomaly: false };
  }
}
