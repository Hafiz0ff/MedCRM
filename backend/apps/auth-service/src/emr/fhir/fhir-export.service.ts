import { randomUUID } from 'node:crypto';
import {
  ForbiddenException,
  Injectable,
  NotAcceptableException,
  NotFoundException
} from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { AuthenticatedUser } from '@core/security/jwt-payload';
import { AuditLoggerService } from '@core/audit/audit-logger.service';
import {
  buildBundle,
  mapCondition,
  mapEncounter,
  mapMedicationRequest,
  mapObservation,
  mapPatient
} from './fhir-mappers';
import {
  FhirBundle,
  FhirCondition,
  FhirEncounter,
  FhirMedicationRequest,
  FhirObservation,
  FhirPatient,
  FhirResourceTypeName,
  FhirSupportedResource
} from './fhir.types';
import { FhirExportQueryDto } from '../dto/fhir-export.dto';

type DateWindow = { gte?: Date; lte?: Date };

/**
 * Aggregates EMR data from PostgreSQL via Prisma and assembles a FHIR R4
 * Bundle for export. Enforces tenant isolation, applies date filtering, and
 * asynchronously records an audit event for every export.
 */
@Injectable()
export class FhirExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLoggerService
  ) {}

  async exportPatientBundle(
    user: AuthenticatedUser,
    patientId: string,
    query: FhirExportQueryDto
  ): Promise<FhirBundle> {
    if (query._format === 'xml') {
      throw new NotAcceptableException(
        'FHIR XML serialization is not enabled on this deployment. Request _format=json or omit _format.'
      );
    }

    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
      include: { contacts: true, medicalRecord: true }
    });

    if (!patient) {
      throw new NotFoundException('Пациент не найден');
    }
    if (patient.tenantId !== user.tenantId) {
      throw new ForbiddenException('Пациент принадлежит другому tenant');
    }

    const window: DateWindow = {
      gte: query.dateFrom ? new Date(query.dateFrom) : undefined,
      lte: query.dateTo ? new Date(query.dateTo) : undefined
    };

    const requested = query.resourceType;
    const wantAll = !requested;

    const resources: FhirSupportedResource[] = [];

    if (wantAll || requested === 'Patient') {
      resources.push(mapPatient(patient) satisfies FhirPatient);
    }

    if (wantAll || requested === 'Encounter') {
      const encounters = await this.fetchEncounters(patient.id, user.tenantId, window);
      for (const enc of encounters) {
        resources.push(mapEncounter(enc) satisfies FhirEncounter);
      }
    }

    if (wantAll || requested === 'Condition') {
      const conditions = await this.fetchConditions(patient.id, user.tenantId, window);
      for (const cond of conditions) {
        resources.push(mapCondition(cond) satisfies FhirCondition);
      }
    }

    if (wantAll || requested === 'MedicationRequest') {
      const prescriptions = await this.fetchMedicationRequests(
        patient.id,
        user.tenantId,
        window
      );
      for (const rx of prescriptions) {
        resources.push(mapMedicationRequest(rx) satisfies FhirMedicationRequest);
      }
    }

    if (wantAll || requested === 'Observation') {
      const observations = await this.fetchObservations(patient.id, user.tenantId, window);
      for (const o of observations) {
        resources.push(mapObservation(o) satisfies FhirObservation);
      }
    }

    const bundle = buildBundle({
      id: randomUUID(),
      type: requested ? 'searchset' : 'collection',
      resources
    });

    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.userId,
      action: 'emr.fhir.export',
      entityType: 'patient',
      entityId: patient.id,
      newValuesJson: {
        bundleId: bundle.id,
        resourceType: requested ?? 'ALL',
        dateFrom: query.dateFrom ?? null,
        dateTo: query.dateTo ?? null,
        format: query._format,
        total: bundle.total,
        countsByType: summarizeResources(resources)
      }
    });

    return bundle;
  }

  private async fetchEncounters(
    patientId: string,
    tenantId: string,
    window: DateWindow
  ) {
    const startedAtFilter = window.gte || window.lte ? { startedAt: toRange(window) } : {};
    return this.prisma.encounter.findMany({
      where: {
        tenantId,
        patientId,
        ...startedAtFilter
      },
      include: {
        doctor: { select: { firstName: true, lastName: true } },
        patient: { select: { fullName: true } },
        diagnoses: { select: { id: true, diagnosisCode: true, isPrimary: true } },
        compositions: { select: { title: true } }
      },
      orderBy: { startedAt: 'asc' }
    });
  }

  private async fetchConditions(
    patientId: string,
    tenantId: string,
    window: DateWindow
  ) {
    const createdAtFilter = window.gte || window.lte ? { createdAt: toRange(window) } : {};
    const rows = await this.prisma.encounterDiagnosis.findMany({
      where: {
        tenantId,
        encounter: { patientId, tenantId },
        ...createdAtFilter
      },
      include: {
        encounter: { select: { patientId: true } }
      },
      orderBy: { createdAt: 'asc' }
    });

    const codes = Array.from(new Set(rows.map((r) => r.diagnosisCode)));
    const dictionary = codes.length
      ? await this.prisma.diagnosisDictionary.findMany({
          where: { code: { in: codes } }
        })
      : [];
    const dictByCode = new Map(dictionary.map((d) => [d.code, d]));

    return rows.map((r) => ({
      id: r.id,
      encounterId: r.encounterId,
      diagnosisCode: r.diagnosisCode,
      diagnosisType: r.diagnosisType,
      isPrimary: r.isPrimary,
      notes: r.notes,
      createdAt: r.createdAt,
      createdBy: r.createdBy,
      patientId: r.encounter.patientId,
      codeSystem: dictByCode.get(r.diagnosisCode)?.codeSystem ?? null,
      display: dictByCode.get(r.diagnosisCode)?.nameRu ?? null
    }));
  }

  private async fetchMedicationRequests(
    patientId: string,
    tenantId: string,
    window: DateWindow
  ) {
    const createdAtFilter = window.gte || window.lte ? { createdAt: toRange(window) } : {};
    const rows = await this.prisma.prescription.findMany({
      where: {
        tenantId,
        prescriptionType: 'MEDICATION',
        encounter: { patientId, tenantId },
        ...createdAtFilter
      },
      include: {
        items: true,
        encounter: { select: { patientId: true } }
      },
      orderBy: { createdAt: 'asc' }
    });

    return rows.map((rx) => ({
      id: rx.id,
      encounterId: rx.encounterId,
      patientId: rx.encounter.patientId,
      status: rx.status,
      prescriptionType: rx.prescriptionType,
      notes: rx.notes,
      createdAt: rx.createdAt,
      createdBy: rx.createdBy,
      items: rx.items.map((item) => ({
        itemCode: item.itemCode,
        itemName: item.itemName,
        dosage: item.dosage,
        frequency: item.frequency,
        duration: item.duration,
        route: item.route,
        quantity: item.quantity,
        instructions: item.instructions
      }))
    }));
  }

  private async fetchObservations(
    patientId: string,
    tenantId: string,
    window: DateWindow
  ) {
    const observedAtFilter = window.gte || window.lte
      ? { observedAt: toRange(window) }
      : {};
    return this.prisma.clinicalObservation.findMany({
      where: {
        tenantId,
        patientId,
        ...observedAtFilter
      },
      orderBy: { observedAt: 'asc' }
    });
  }
}

function toRange(window: DateWindow): { gte?: Date; lte?: Date } {
  const range: { gte?: Date; lte?: Date } = {};
  if (window.gte) range.gte = window.gte;
  if (window.lte) range.lte = window.lte;
  return range;
}

function summarizeResources(
  resources: FhirSupportedResource[]
): Record<FhirResourceTypeName, number> {
  const counts: Record<FhirResourceTypeName, number> = {
    Patient: 0,
    Encounter: 0,
    Condition: 0,
    MedicationRequest: 0,
    Observation: 0
  };
  for (const r of resources) {
    counts[r.resourceType as FhirResourceTypeName] =
      (counts[r.resourceType as FhirResourceTypeName] ?? 0) + 1;
  }
  return counts;
}
