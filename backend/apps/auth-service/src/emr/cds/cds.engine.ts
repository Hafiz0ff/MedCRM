import { PrismaService } from '@core/database/prisma.service';
import { Injectable } from '@nestjs/common';

export interface CdsAlert {
  ruleId: string;
  severity: 'block' | 'warning' | 'info';
  title: string;
  message: string;
  recommendation?: string;
}

export interface CdsCheckInput {
  patientId: string;
  encounterId?: string | null;
  items: Array<{
    innCode?: string | null;
    medicinalProductId?: string | null;
    itemName: string;
    dose?: number | null;
    doseUnit?: string | null;
    frequencyPerDay?: number | null;
  }>;
}

@Injectable()
export class CdsEngine {
  constructor(private readonly prisma: PrismaService) {}

  async check(tenantId: string, input: CdsCheckInput): Promise<CdsAlert[]> {
    const alerts: CdsAlert[] = [];
    const { patientId, items } = input;

    if (!items || items.length === 0) {
      return alerts;
    }

    // 1. Resolve INNs for incoming items
    const resolvedInns = new Set<string>();
    const resolvedMedProducts: Record<string, string> = {}; // medProductId -> innCode

    for (const item of items) {
      if (item.innCode) {
        resolvedInns.add(item.innCode);
      } else if (item.medicinalProductId) {
        const medProd = await this.prisma.referenceMedicinalProduct.findUnique({
          where: { id: item.medicinalProductId },
        });
        if (medProd) {
          resolvedInns.add(medProd.innCode);
          resolvedMedProducts[item.medicinalProductId] = medProd.innCode;
        }
      }
    }

    const incomingInnCodes = Array.from(resolvedInns);

    // 2. Fetch Patient Clinical Context
    const [allergies, pregnancy, chronicConditions, activePrescriptions, latestVitals, latestLabs] =
      await Promise.all([
        // Patient Allergies
        this.prisma.patientAllergy.findMany({
          where: { tenantId, patientId, clinicalStatus: 'active' },
          include: { allergen: true },
        }),
        // Pregnancy State
        this.prisma.patientPregnancyState.findFirst({
          where: { tenantId, patientId, status: 'ACTIVE' },
        }),
        // Chronic Conditions
        this.prisma.patientChronicCondition.findMany({
          where: { tenantId, patientId, clinicalStatus: 'active' },
        }),
        this.prisma.prescription.findMany({
          where: {
            tenantId,
            encounter: { patientId },
            status: 'ACTIVE',
          },
          include: {
            encounter: true,
            items: {
              include: { inn: true },
            },
          },
        }),
        // Latest Vitals
        this.prisma.vitalSign.findMany({
          where: { tenantId, patientId },
          orderBy: { measuredAt: 'desc' },
          take: 10,
        }),
        // Latest Lab Reports
        this.prisma.labReport.findMany({
          where: { tenantId, patientId, status: 'FINAL' },
          include: { items: true },
          orderBy: { reportedAt: 'desc' },
          take: 3,
        }),
      ]);

    // Gather active prescription INN codes
    const activeInnCodes = new Set<string>();
    for (const rx of activePrescriptions) {
      // Safety check: only count active prescriptions for this patient
      if (rx.encounter?.patientId !== patientId) continue;
      for (const rxItem of rx.items) {
        if (rxItem.innCode) {
          activeInnCodes.add(rxItem.innCode);
        }
      }
    }

    // --- RULE 1: ALLERGY CHECK ---
    for (const innCode of incomingInnCodes) {
      const allergyMatch = allergies.find(
        (a) => a.allergen.innCode === innCode || a.allergen.code === innCode,
      );
      if (allergyMatch) {
        const innInfo = await this.prisma.referenceInn.findUnique({ where: { code: innCode } });
        alerts.push({
          ruleId: 'ALLERGY_ALERT',
          severity: allergyMatch.severity === 'severe' ? 'block' : 'warning',
          title: `Аллергия на препарат: ${innInfo?.nameRu || innCode}`,
          message: `У пациента зарегистрирована аллергическая реакция (статус: ${allergyMatch.severity}).`,
          recommendation: allergyMatch.notes || 'Назначьте альтернативный препарат.',
        });
      }
    }

    // --- RULE 2: DRUG-DRUG INTERACTION (DDI) ---
    // Compare new items against each other and against active prescriptions
    const allInnsToCheck = new Set([...incomingInnCodes, ...activeInnCodes]);
    const ddiPairsChecked = new Set<string>();

    for (const innA of incomingInnCodes) {
      for (const innB of allInnsToCheck) {
        if (innA === innB) continue;

        // Ensure stable key for pairwise checking
        const key = [innA, innB].sort().join('-');
        if (ddiPairsChecked.has(key)) continue;
        ddiPairsChecked.add(key);

        const ddi = await this.prisma.referenceDdi.findFirst({
          where: {
            OR: [
              { innCodeA: innA, innCodeB: innB },
              { innCodeA: innB, innCodeB: innA },
            ],
          },
        });

        if (ddi) {
          const [innInfoA, innInfoB] = await Promise.all([
            this.prisma.referenceInn.findUnique({ where: { code: innA } }),
            this.prisma.referenceInn.findUnique({ where: { code: innB } }),
          ]);
          alerts.push({
            ruleId: 'DDI_ALERT',
            severity: ddi.severity === 'contraindicated' ? 'block' : 'warning',
            title: `Лекарственное взаимодействие: ${innInfoA?.nameRu || innA} + ${innInfoB?.nameRu || innB}`,
            message: `Обнаружено взаимодействие степени "${ddi.severity}". Механизм: ${ddi.mechanism || 'Неизвестен'}`,
            recommendation: ddi.recommendation || 'Рассмотрите изменение дозировки или замену.',
          });
        }
      }
    }

    // --- RULE 3: DUPLICATE THERAPY ---
    for (const innCode of incomingInnCodes) {
      if (activeInnCodes.has(innCode)) {
        const innInfo = await this.prisma.referenceInn.findUnique({ where: { code: innCode } });
        alerts.push({
          ruleId: 'DUPLICATE_THERAPY',
          severity: 'warning',
          title: `Дублирование терапии: ${innInfo?.nameRu || innCode}`,
          message: 'Этот препарат уже назначен пациенту в рамках активных рецептов.',
          recommendation: 'Проверьте активные назначения перед продлением или добавлением.',
        });
      }
    }

    // --- RULE 4: PREGNANCY STATE ---
    if (pregnancy) {
      for (const innCode of incomingInnCodes) {
        const innInfo = await this.prisma.referenceInn.findUnique({ where: { code: innCode } });
        if (innInfo?.fdaPregnancyCategory === 'D' || innInfo?.fdaPregnancyCategory === 'X') {
          alerts.push({
            ruleId: 'PREGNANCY_CONTRAINDICATION',
            severity: innInfo.fdaPregnancyCategory === 'X' ? 'block' : 'warning',
            title: `Противопоказано при беременности: ${innInfo.nameRu || innCode}`,
            message: `Препарат относится к категории FDA "${innInfo.fdaPregnancyCategory}". Пациентка беременна (ПДР: ${pregnancy.estimatedDeliveryDate?.toLocaleDateString() || 'Не указана'}).`,
            recommendation: 'Используйте более безопасные аналоги категории A или B.',
          });
        }
      }
    }

    // --- RULE 5: RENAL & HEPATIC ADJUSTMENTS ---
    const hasRenalFailure = chronicConditions.some(
      (c) =>
        c.icdCode.startsWith('N18') ||
        c.icdCode.startsWith('I12') ||
        c.notes?.toLowerCase().includes('renal'),
    );
    const hasHepaticFailure = chronicConditions.some(
      (c) =>
        c.icdCode.startsWith('K70') ||
        c.icdCode.startsWith('K74') ||
        c.notes?.toLowerCase().includes('hepatic'),
    );

    for (const innCode of incomingInnCodes) {
      const innInfo = await this.prisma.referenceInn.findUnique({ where: { code: innCode } });
      if (innInfo) {
        if (hasRenalFailure && innInfo.requiresRenalAdjustment) {
          alerts.push({
            ruleId: 'RENAL_ADJUSTMENT',
            severity: 'warning',
            title: `Коррекция дозы при почечной недостаточности: ${innInfo.nameRu || innCode}`,
            message:
              'У пациента активна почечная недостаточность. Данный препарат требует адаптации дозировки.',
            recommendation:
              'Рассчитайте клиренс креатинина и скорректируйте дозу согласно инструкции.',
          });
        }
        if (hasHepaticFailure && innInfo.requiresHepaticAdjustment) {
          alerts.push({
            ruleId: 'HEPATIC_ADJUSTMENT',
            severity: 'warning',
            title: `Коррекция дозы при печеночной недостаточности: ${innInfo.nameRu || innCode}`,
            message:
              'У пациента активна печеночная недостаточность. Препарат требует коррекции или осторожного назначения.',
            recommendation: 'Оцените функцию печени по шкале Чайлд-Пью.',
          });
        }
      }
    }

    // --- RULE 6: VITAL PARAMETERS CRITICAL LIMITS ---
    const latestByType: Record<string, (typeof latestVitals)[0]> = {};
    for (const v of latestVitals) {
      if (!latestByType[v.type]) {
        latestByType[v.type] = v;
      }
    }

    for (const [type, vital] of Object.entries(latestByType)) {
      if (vital.alertLevel === 'CRITICAL') {
        alerts.push({
          ruleId: 'VITAL_ALERT',
          severity: 'warning',
          title: `Критический витал-параметр: ${type} = ${vital.value} ${vital.unit}`,
          message: `Последнее измерение от ${vital.measuredAt.toLocaleDateString()} зафиксировало критическое отклонение.`,
          recommendation: 'Убедитесь в стабильности состояния пациента перед назначением лекарств.',
        });
      }
    }

    // --- RULE 7: CRITICAL LAB RESULTS ---
    for (const report of latestLabs) {
      const criticalItem = report.items.find(
        (item) => item.abnormality === 'CRITICAL' || item.flag === 'HH' || item.flag === 'LL',
      );
      if (criticalItem) {
        alerts.push({
          ruleId: 'LAB_ALERT',
          severity: 'warning',
          title: `Критический лабораторный показатель: ${criticalItem.analyteName}`,
          message: `Результат: ${criticalItem.value !== null ? criticalItem.value : criticalItem.valueText} ${criticalItem.unit || ''} (референс: ${criticalItem.refRangeLow}-${criticalItem.refRangeHigh}).`,
          recommendation: 'Изучите лабораторный отчет перед внесением изменений в лист назначений.',
        });
        break; // Show only one consolidated lab report warning
      }
    }

    return alerts;
  }
}
