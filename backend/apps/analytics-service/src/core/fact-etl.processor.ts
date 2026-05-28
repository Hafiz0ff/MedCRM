import { PrismaService } from '@core/database/prisma.service';
import { Injectable, Logger } from '@nestjs/common';
import { ClickHouseService } from './clickhouse.service';

@Injectable()
export class FactEtlProcessor {
  private readonly logger = new Logger(FactEtlProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clickhouse: ClickHouseService,
  ) {}

  /**
   * Запуск ETL-процесса для конкретного тенанта
   */
  async runEtl(tenantId: string): Promise<void> {
    const startTime = Date.now();
    this.logger.log(`Запуск аналитического ETL для тенанта: ${tenantId}`);

    try {
      // 1. Агрегация DwFactAppointment
      const appointments = await this.prisma.appointment.findMany({
        where: { tenantId },
      });

      await this.prisma.dwFactAppointment.deleteMany({ where: { tenantId } });
      const factAppointments = appointments.map((appt) => ({
        tenantId: appt.tenantId,
        branchId: appt.branchId,
        employeeId: appt.employeeId,
        patientId: appt.patientId,
        serviceId: appt.serviceId,
        appointmentStatus: appt.status,
        bookingSource: appt.bookingSource || 'OFFLINE',
        durationMinutes: appt.durationMinutes,
        noShowFlag: appt.status === 'MISSED',
        completedFlag: appt.status === 'COMPLETED',
        createdDate: appt.createdAt,
        appointmentDate: appt.startAt,
      }));

      if (factAppointments.length > 0) {
        await this.prisma.dwFactAppointment.createMany({
          data: factAppointments,
        });

        // Запись в ClickHouse если доступен
        if (this.clickhouse.isEnabled()) {
          await this.clickhouse.write('stg.appointments', factAppointments);
        }
      }

      // 2. Агрегация DwFactPayment
      const payments = await this.prisma.payment.findMany({
        where: { tenantId, status: 'COMPLETED' },
      });

      await this.prisma.dwFactPayment.deleteMany({ where: { tenantId } });
      const factPayments = payments.map((pay) => ({
        tenantId: pay.tenantId,
        branchId: pay.branchId,
        invoiceId: pay.invoiceId,
        patientId: pay.patientId,
        paymentMethod: pay.paymentMethod,
        amount: pay.amount,
        discountAmount: 0, // Упрощено
        materialCost: 0, // Упрощено
        paymentDate: pay.paidAt,
      }));

      if (factPayments.length > 0) {
        await this.prisma.dwFactPayment.createMany({
          data: factPayments,
        });

        if (this.clickhouse.isEnabled()) {
          await this.clickhouse.write('stg.payments', factPayments);
        }
      }

      // 3. Агрегация DwFactMarketing
      const patients = await this.prisma.patient.findMany({
        where: { tenantId },
        include: { leads: true, invoices: true },
      });

      await this.prisma.dwFactMarketing.deleteMany({ where: { tenantId } });
      const factMarketing = patients.map((pat) => {
        const lead = pat.leads[0];
        const paidInvoices = pat.invoices.filter((i) => i.status === 'PAID');
        const ltv = paidInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
        const firstPayment = paidInvoices.sort(
          (a, b) => a.invoiceDate.getTime() - b.invoiceDate.getTime(),
        )[0];

        return {
          tenantId: pat.tenantId,
          patientId: pat.id,
          leadSource: lead?.sourceType || 'DIRECT',
          utmSource: lead?.utmSource || null,
          utmCampaign: lead?.utmCampaign || null,
          acquisitionCost: lead ? 500 : 0, // Мок стоимость привлечения
          firstVisitDate: pat.createdAt,
          firstPaymentDate: firstPayment ? firstPayment.invoiceDate : null,
          ltv,
        };
      });

      if (factMarketing.length > 0) {
        await this.prisma.dwFactMarketing.createMany({
          data: factMarketing,
        });
      }

      // 4. Финансовые агрегаты по дням (Daily Aggregates)
      await this.prisma.financialDailyAggregate.deleteMany({ where: { tenantId } });
      // Агрегируем платежи по дням
      const paymentsByDay: Record<string, { rev: number; count: number; branchId?: string }> = {};
      for (const p of factPayments) {
        const dayStr = p.paymentDate.toISOString().slice(0, 10);
        const key = `${dayStr}_${p.branchId || 'main'}`;
        if (!paymentsByDay[key]) {
          paymentsByDay[key] = { rev: 0, count: 0, branchId: p.branchId };
        }
        paymentsByDay[key].rev += Number(p.amount);
        paymentsByDay[key].count += 1;
      }

      const financialDaily = Object.entries(paymentsByDay).map(([key, data]) => {
        const [dayStr] = key.split('_');
        return {
          tenantId,
          branchId: data.branchId || null,
          aggregationDate: new Date(dayStr),
          totalRevenue: data.rev,
          totalProfit: data.rev * 0.7, // 70% маржинальность
          totalExpenses: data.rev * 0.3,
          totalRefunds: 0,
          averageCheck: data.count > 0 ? data.rev / data.count : 0,
          outstandingDebt: 0,
        };
      });

      if (financialDaily.length > 0) {
        await this.prisma.financialDailyAggregate.createMany({
          data: financialDaily,
        });
      }

      // 5. Расчет KPI врачей (Doctor KPI)
      await this.prisma.doctorKpiMetric.deleteMany({ where: { tenantId } });
      const doctors = await this.prisma.employee.findMany({
        where: { tenantId, user: { isNot: null } },
      });

      const doctorKpi = doctors.map((doc) => {
        const docAppts = factAppointments.filter((a) => a.employeeId === doc.id);
        const totalVisits = docAppts.filter((a) => a.completedFlag).length;
        const totalRevenue = factPayments
          .filter((p) => {
            // Для упрощения, связываем платеж с врачом, если у пациента был завершенный прием в тот же день
            const appt = docAppts.find(
              (a) =>
                a.patientId === p.patientId &&
                a.appointmentDate.toDateString() === p.paymentDate.toDateString(),
            );
            return !!appt;
          })
          .reduce((sum, p) => sum + Number(p.amount), 0);

        const noShows = docAppts.filter((a) => a.noShowFlag).length;
        const totalBooked = docAppts.length;
        const noShowRate = totalBooked > 0 ? (noShows / totalBooked) * 100 : 0;

        // Мок утилизации и nps
        const totalHours = totalVisits * 0.5; // в среднем 30 мин на прием
        const utilizationRate = Math.min((totalHours / 40) * 100, 100); // на базе 40ч рабочей недели

        return {
          tenantId,
          employeeId: doc.id,
          branchId: docAppts[0]?.branchId || null,
          totalVisits,
          totalRevenue,
          utilizationRate,
          retentionRate: 85, // Мок
          noShowRate,
          averageCheck: totalVisits > 0 ? totalRevenue / totalVisits : 0,
          npsScore: 4.8,
        };
      });

      if (doctorKpi.length > 0) {
        await this.prisma.doctorKpiMetric.createMany({
          data: doctorKpi,
        });
      }

      // 6. Реальное кэширование метрик (RealtimeMetricCache)
      await this.prisma.realtimeMetricCache.deleteMany({ where: { tenantId } });
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayRevenue = factPayments
        .filter((p) => p.paymentDate >= today)
        .reduce((sum, p) => sum + Number(p.amount), 0);

      const activeQueuesCount = await this.prisma.visitQueue.count({
        where: { tenantId, queueStatus: 'WAITING' },
      });

      await this.prisma.realtimeMetricCache.createMany({
        data: [
          {
            tenantId,
            metricCode: 'TODAY_REVENUE',
            metricValue: String(todayRevenue),
          },
          {
            tenantId,
            metricCode: 'ACTIVE_QUEUE_COUNT',
            metricValue: String(activeQueuesCount),
          },
        ],
      });

      this.logger.log(`ETL успешно завершен за ${Date.now() - startTime} мс.`);
    } catch (err: any) {
      this.logger.error(`Ошибка при выполнении аналитического ETL: ${err.message}`, err.stack);
      throw err;
    }
  }
}
