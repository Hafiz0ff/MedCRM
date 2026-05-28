import { PrismaService } from '@core/database/prisma.service';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MlClient {
  private readonly logger = new Logger(MlClient.name);
  private endpointUrl!: string;
  private isAvailable = false;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.endpointUrl = this.config.get<string>('ML_SERVICE_URL', '');
    if (this.endpointUrl) {
      this.isAvailable = true;
    }
  }

  /**
   * Предсказание вероятности неявки (No-Show Prediction)
   */
  async predictNoShow(
    tenantId: string,
    appointmentId: string,
  ): Promise<{ riskScore: number; riskCategory: 'LOW' | 'MEDIUM' | 'HIGH'; reasons: string[] }> {
    if (this.isAvailable) {
      try {
        const res = await fetch(`${this.endpointUrl}/predict/no-show`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenantId, appointmentId }),
          signal: AbortSignal.timeout(2000),
        });

        if (res.ok) {
          return await res.json();
        }
      } catch (err: any) {
        this.logger.warn(
          `Ошибка при вызове удаленной ML-модели no-show (${err.message}). Применяем локальный классификатор.`,
        );
      }
    }

    // --- Локальный решающий классификатор (Fallback Decision Tree) ---
    const appt = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!appt || appt.tenantId !== tenantId) {
      return { riskScore: 0.1, riskCategory: 'LOW', reasons: ['Запись не найдена'] };
    }

    const patientMetric = await this.prisma.patientCrmMetric.findUnique({
      where: { patientId: appt.patientId },
    });

    let score = 0.12; // Базовая вероятность неявки (12%)
    const reasons: string[] = [];

    // Фактор 1: История неявок пациента
    if (patientMetric) {
      if (patientMetric.missedAppointments > 2) {
        score += 0.35;
        reasons.push('Пациент ранее пропустил более 2 приёмов');
      } else if (patientMetric.missedAppointments > 0) {
        score += 0.15;
        reasons.push('Пациент ранее пропускал приёмы');
      }
    }

    // Фактор 2: Приоритет записи
    if (appt.priority === 'VIP') {
      score -= 0.05;
    }

    // Фактор 3: Источник бронирования
    if (appt.bookingSource === 'PORTAL' || appt.bookingSource === 'ONLINE') {
      score -= 0.03;
    } else if (appt.bookingSource === 'MARKETPLACE') {
      score += 0.08;
      reasons.push('Запись сделана через сторонний агрегатор');
    }

    // Фактор 4: Время до приема от момента создания (срочные приемы реже пропускают)
    const hoursToAppt = (appt.startAt.getTime() - appt.createdAt.getTime()) / (1000 * 60 * 60);
    if (hoursToAppt > 168) {
      // более 7 дней
      score += 0.15;
      reasons.push('Запись создана более чем за неделю до приёма');
    } else if (hoursToAppt < 24) {
      score -= 0.04;
    }

    // Фактор 5: День недели (в выходные пропускают чаще)
    const day = appt.startAt.getDay();
    if (day === 0 || day === 6) {
      score += 0.05;
      reasons.push('Приём запланирован на выходной день');
    }

    // Ограничиваем рамками [0.01, 0.99]
    score = Math.max(0.01, Math.min(score, 0.99));

    let category: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    if (score > 0.45) {
      category = 'HIGH';
    } else if (score > 0.2) {
      category = 'MEDIUM';
    }

    return {
      riskScore: parseFloat(score.toFixed(2)),
      riskCategory: category,
      reasons,
    };
  }

  /**
   * Предсказание оттока пациента (Patient Churn Prediction)
   */
  async predictPatientChurn(
    tenantId: string,
    patientId: string,
  ): Promise<{ churnProbability: number; isRisk: boolean; segment: string }> {
    const metric = await this.prisma.patientCrmMetric.findUnique({
      where: { patientId },
    });

    if (!metric || metric.tenantId !== tenantId) {
      return { churnProbability: 0.05, isRisk: false, segment: 'ACTIVE' };
    }

    let prob = 0.1; // Базовая вероятность (10%)

    // Фактор времени с последнего визита
    if (metric.lastVisitAt) {
      const daysSinceLastVisit =
        (Date.now() - metric.lastVisitAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceLastVisit > 360) {
        prob += 0.65;
      } else if (daysSinceLastVisit > 180) {
        prob += 0.35;
      } else if (daysSinceLastVisit > 90) {
        prob += 0.15;
      }
    } else {
      prob += 0.4; // не было визитов
    }

    // Фактор лояльности
    if (metric.totalVisits > 5) {
      prob -= 0.15;
    } else if (metric.totalVisits > 2) {
      prob -= 0.05;
    }

    if (metric.missedAppointments > 1) {
      prob += 0.1;
    }

    prob = Math.max(0.01, Math.min(prob, 0.99));

    let segment = 'ACTIVE';
    if (prob > 0.65) {
      segment = 'CHURNED';
    } else if (prob > 0.35) {
      segment = 'RISK';
    }

    return {
      churnProbability: parseFloat(prob.toFixed(2)),
      isRisk: prob > 0.35,
      segment,
    };
  }
}
