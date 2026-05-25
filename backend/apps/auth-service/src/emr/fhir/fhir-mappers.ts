/**
 * Pure mappers: Prisma rows -> FHIR R4 resources.
 *
 * The mappers are intentionally side-effect free so the export service can
 * compose them in any order and they remain trivially unit-testable.
 *
 * All resource ids use the internal MedCRM UUID. The `system` for identifiers
 * is namespaced per tenant under `http://medcrm.ru/...` to avoid collisions
 * between clinics that exchange FHIR payloads through B2B integrations.
 */

import {
  FhirBundle,
  FhirBundleEntry,
  FhirCondition,
  FhirEncounter,
  FhirMedicationRequest,
  FhirObservation,
  FhirPatient,
  FhirSupportedResource
} from './fhir.types';

const MEDCRM_SYSTEM_BASE = 'http://medcrm.ru';
const TERMINOLOGY_DIAGNOSIS_ROLE =
  'http://terminology.hl7.org/CodeSystem/diagnosis-role';
const TERMINOLOGY_CONDITION_CLINICAL =
  'http://terminology.hl7.org/CodeSystem/condition-clinical';
const TERMINOLOGY_CONDITION_VER_STATUS =
  'http://terminology.hl7.org/CodeSystem/condition-ver-status';
const TERMINOLOGY_OBSERVATION_INTERPRETATION =
  'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation';
const TERMINOLOGY_ACTCODE = 'http://terminology.hl7.org/CodeSystem/v3-ActCode';
const TERMINOLOGY_PARTICIPATION_TYPE =
  'http://terminology.hl7.org/CodeSystem/v3-ParticipationType';

const ENCOUNTER_STATUS_BY_INTERNAL: Record<string, FhirEncounter['status']> = {
  DRAFT: 'planned',
  IN_PROGRESS: 'in-progress',
  SIGNED: 'finished',
  AMENDED: 'finished',
  CANCELLED: 'cancelled'
};

export type PatientLike = {
  id: string;
  tenantId: string;
  patientCode: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  birthDate: Date | null;
  gender: string | null;
  status: string;
  archivedAt: Date | null;
  updatedAt: Date;
  contacts?: Array<{
    type: string;
    value: string;
    isPrimary: boolean;
  }>;
  medicalRecord?: { bloodType: string | null } | null;
};

export function mapPatient(patient: PatientLike): FhirPatient {
  const telecom = (patient.contacts ?? []).map((c) => ({
    system:
      c.type === 'PHONE' ? ('phone' as const)
      : c.type === 'EMAIL' ? ('email' as const)
      : ('other' as const),
    value: c.value,
    use: c.isPrimary ? ('home' as const) : ('work' as const)
  }));

  const given = [patient.firstName, patient.middleName ?? undefined].filter(
    (v): v is string => !!v
  );

  return {
    resourceType: 'Patient',
    id: patient.id,
    meta: { lastUpdated: patient.updatedAt.toISOString() },
    identifier: [
      {
        use: 'official',
        system: `${MEDCRM_SYSTEM_BASE}/tenant/${patient.tenantId}/patient-code`,
        value: patient.patientCode
      }
    ],
    active: patient.archivedAt === null,
    name: [
      {
        use: 'official',
        family: patient.lastName,
        given
      }
    ],
    telecom: telecom.length > 0 ? telecom : undefined,
    gender: normalizeGender(patient.gender),
    birthDate: patient.birthDate
      ? patient.birthDate.toISOString().slice(0, 10)
      : undefined,
    extension: patient.medicalRecord?.bloodType
      ? [
          {
            url: `${MEDCRM_SYSTEM_BASE}/fhir/StructureDefinition/blood-type`,
            valueString: patient.medicalRecord.bloodType
          }
        ]
      : undefined
  };
}

function normalizeGender(value: string | null): FhirPatient['gender'] {
  if (!value) return 'unknown';
  const v = value.toLowerCase();
  if (v === 'male' || v === 'm') return 'male';
  if (v === 'female' || v === 'f') return 'female';
  if (v === 'other') return 'other';
  return 'unknown';
}

export type EncounterLike = {
  id: string;
  patientId: string;
  doctorEmployeeId: string;
  episodeId: string | null;
  status: string;
  encounterType: string;
  startedAt: Date;
  completedAt: Date | null;
  doctor?: { firstName: string; lastName: string };
  patient?: { fullName: string };
  diagnoses?: Array<{ id: string; diagnosisCode: string; isPrimary: boolean }>;
  compositions?: Array<{ title: string }>;
};

export function mapEncounter(encounter: EncounterLike): FhirEncounter {
  const reasonCode = (encounter.compositions ?? [])
    .map((c) => c.title)
    .filter((t) => !!t)
    .map((text) => ({ text }));

  return {
    resourceType: 'Encounter',
    id: encounter.id,
    meta: { lastUpdated: encounter.startedAt.toISOString() },
    status:
      ENCOUNTER_STATUS_BY_INTERNAL[encounter.status] ?? 'in-progress',
    class: {
      system: TERMINOLOGY_ACTCODE,
      code: 'AMB',
      display: 'ambulatory'
    },
    type: encounter.encounterType
      ? [{ text: encounter.encounterType }]
      : undefined,
    subject: {
      reference: `Patient/${encounter.patientId}`,
      display: encounter.patient?.fullName
    },
    participant: [
      {
        type: [
          {
            coding: [
              {
                system: TERMINOLOGY_PARTICIPATION_TYPE,
                code: 'PPRF',
                display: 'primary performer'
              }
            ]
          }
        ],
        individual: {
          reference: `Practitioner/${encounter.doctorEmployeeId}`,
          display: encounter.doctor
            ? `${encounter.doctor.lastName} ${encounter.doctor.firstName}`
            : undefined
        }
      }
    ],
    period: {
      start: encounter.startedAt.toISOString(),
      end: encounter.completedAt
        ? encounter.completedAt.toISOString()
        : undefined
    },
    reasonCode: reasonCode.length > 0 ? reasonCode : undefined,
    diagnosis:
      encounter.diagnoses && encounter.diagnoses.length > 0
        ? encounter.diagnoses.map((d, index) => ({
            condition: {
              reference: `Condition/${d.id}`,
              display: d.diagnosisCode
            },
            use: {
              coding: [
                {
                  system: TERMINOLOGY_DIAGNOSIS_ROLE,
                  code: d.isPrimary ? 'AD' : 'DD',
                  display: d.isPrimary
                    ? 'Admission diagnosis'
                    : 'Discharge diagnosis'
                }
              ]
            },
            rank: index + 1
          }))
        : undefined,
    partOf: encounter.episodeId
      ? { reference: `EpisodeOfCare/${encounter.episodeId}` }
      : undefined
  };
}

export type ConditionLike = {
  id: string;
  encounterId: string;
  diagnosisCode: string;
  diagnosisType: string;
  isPrimary: boolean;
  notes: string | null;
  createdAt: Date;
  createdBy: string;
  patientId: string;
  codeSystem?: string | null;
  display?: string | null;
};

export function mapCondition(condition: ConditionLike): FhirCondition {
  const codeSystem = condition.codeSystem ?? 'ICD-10';
  return {
    resourceType: 'Condition',
    id: condition.id,
    meta: { lastUpdated: condition.createdAt.toISOString() },
    clinicalStatus: {
      coding: [
        {
          system: TERMINOLOGY_CONDITION_CLINICAL,
          code: 'active',
          display: 'Active'
        }
      ]
    },
    verificationStatus: {
      coding: [
        {
          system: TERMINOLOGY_CONDITION_VER_STATUS,
          code: mapVerificationStatus(condition.diagnosisType),
          display: condition.diagnosisType
        }
      ]
    },
    category: [
      {
        coding: [
          {
            system: `${MEDCRM_SYSTEM_BASE}/fhir/CodeSystem/condition-category`,
            code: condition.isPrimary ? 'primary' : 'secondary',
            display: condition.isPrimary ? 'Primary diagnosis' : 'Secondary diagnosis'
          }
        ]
      }
    ],
    code: {
      coding: [
        {
          system: codeSystem === 'ICD-11'
            ? 'http://id.who.int/icd/release/11/mms'
            : 'http://hl7.org/fhir/sid/icd-10',
          code: condition.diagnosisCode,
          display: condition.display ?? undefined
        }
      ],
      text: condition.display ?? undefined
    },
    subject: { reference: `Patient/${condition.patientId}` },
    encounter: { reference: `Encounter/${condition.encounterId}` },
    recordedDate: condition.createdAt.toISOString(),
    recorder: { reference: `Practitioner/${condition.createdBy}` },
    note: condition.notes ? [{ text: condition.notes }] : undefined
  };
}

function mapVerificationStatus(diagnosisType: string): string {
  switch (diagnosisType) {
    case 'FINAL':
    case 'CLINICAL':
      return 'confirmed';
    case 'PRELIMINARY':
      return 'provisional';
    case 'DIFFERENTIAL':
      return 'differential';
    default:
      return 'unconfirmed';
  }
}

export type MedicationRequestLike = {
  id: string;
  encounterId: string;
  patientId: string;
  status: string;
  prescriptionType: string;
  notes: string | null;
  createdAt: Date;
  createdBy: string;
  items: Array<{
    itemCode: string;
    itemName: string;
    dosage: string | null;
    frequency: string | null;
    duration: string | null;
    route: string | null;
    quantity: unknown;
    instructions: string | null;
  }>;
};

export function mapMedicationRequest(
  prescription: MedicationRequestLike
): FhirMedicationRequest {
  const firstItem = prescription.items[0];

  const dosageInstruction = prescription.items.map((item) => ({
    text: buildDosageText(item),
    route: item.route ? { text: item.route } : undefined,
    timing: item.frequency
      ? { code: { text: item.frequency } }
      : undefined,
    doseAndRate: item.dosage
      ? [
          {
            doseQuantity: {
              value: parseLeadingNumber(item.dosage),
              unit: extractUnit(item.dosage) ?? undefined
            }
          }
        ]
      : undefined
  }));

  return {
    resourceType: 'MedicationRequest',
    id: prescription.id,
    meta: { lastUpdated: prescription.createdAt.toISOString() },
    status: mapPrescriptionStatus(prescription.status),
    intent: 'order',
    medicationCodeableConcept: firstItem
      ? {
          coding: [
            {
              system: `${MEDCRM_SYSTEM_BASE}/fhir/CodeSystem/medication`,
              code: firstItem.itemCode,
              display: firstItem.itemName
            }
          ],
          text: firstItem.itemName
        }
      : undefined,
    subject: { reference: `Patient/${prescription.patientId}` },
    encounter: { reference: `Encounter/${prescription.encounterId}` },
    authoredOn: prescription.createdAt.toISOString(),
    requester: { reference: `Practitioner/${prescription.createdBy}` },
    dosageInstruction: dosageInstruction.length > 0 ? dosageInstruction : undefined,
    dispenseRequest: firstItem?.quantity
      ? {
          quantity: {
            value: Number(firstItem.quantity),
            unit: 'units'
          }
        }
      : undefined,
    note: prescription.notes ? [{ text: prescription.notes }] : undefined
  };
}

function buildDosageText(item: MedicationRequestLike['items'][number]): string {
  const parts: string[] = [item.itemName];
  if (item.dosage) parts.push(item.dosage);
  if (item.frequency) parts.push(item.frequency);
  if (item.duration) parts.push(`× ${item.duration}`);
  if (item.route) parts.push(`(${item.route})`);
  if (item.instructions) parts.push(`— ${item.instructions}`);
  return parts.join(' ');
}

function parseLeadingNumber(value: string): number | undefined {
  const match = value.match(/^[\d.,]+/);
  if (!match) return undefined;
  const num = Number(match[0].replace(',', '.'));
  return Number.isFinite(num) ? num : undefined;
}

function extractUnit(value: string): string | undefined {
  const match = value.match(/^[\d.,]+\s*([a-zA-Zа-яА-Я%/]+)/);
  return match?.[1];
}

function mapPrescriptionStatus(
  status: string
): FhirMedicationRequest['status'] {
  switch (status) {
    case 'ACTIVE':
      return 'active';
    case 'COMPLETED':
      return 'completed';
    case 'CANCELLED':
      return 'cancelled';
    case 'ON_HOLD':
      return 'on-hold';
    case 'DRAFT':
      return 'draft';
    default:
      return 'unknown';
  }
}

export type ObservationLike = {
  id: string;
  patientId: string;
  encounterId: string | null;
  observationCode: string;
  observationName: string;
  value: string;
  unit: string | null;
  referenceRange: string | null;
  abnormalFlag: string | null;
  observedAt: Date;
};

export function mapObservation(o: ObservationLike): FhirObservation {
  const numericValue = parseStrictNumber(o.value);

  return {
    resourceType: 'Observation',
    id: o.id,
    meta: { lastUpdated: o.observedAt.toISOString() },
    status: 'final',
    category: [
      {
        coding: [
          {
            system:
              'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'laboratory',
            display: 'Laboratory'
          }
        ]
      }
    ],
    code: {
      coding: [
        {
          system: looksLikeLoinc(o.observationCode)
            ? 'http://loinc.org'
            : `${MEDCRM_SYSTEM_BASE}/terminology/observation`,
          code: o.observationCode,
          display: o.observationName
        }
      ],
      text: o.observationName
    },
    subject: { reference: `Patient/${o.patientId}` },
    encounter: o.encounterId
      ? { reference: `Encounter/${o.encounterId}` }
      : undefined,
    effectiveDateTime: o.observedAt.toISOString(),
    valueString: numericValue === undefined ? o.value : undefined,
    valueQuantity:
      numericValue !== undefined
        ? {
            value: numericValue,
            unit: o.unit ?? undefined
          }
        : undefined,
    interpretation: o.abnormalFlag
      ? [
          {
            coding: [
              {
                system: TERMINOLOGY_OBSERVATION_INTERPRETATION,
                code: o.abnormalFlag,
                display: interpretationDisplay(o.abnormalFlag)
              }
            ]
          }
        ]
      : undefined,
    referenceRange: o.referenceRange ? [{ text: o.referenceRange }] : undefined
  };
}

function parseStrictNumber(value: string): number | undefined {
  if (value === '' || value == null) return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

function looksLikeLoinc(code: string): boolean {
  return /^\d{1,5}-\d$/.test(code);
}

function interpretationDisplay(flag: string): string {
  switch (flag.toUpperCase()) {
    case 'N':
      return 'Normal';
    case 'H':
      return 'High';
    case 'L':
      return 'Low';
    case 'A':
      return 'Abnormal';
    case 'AA':
      return 'Critical abnormal';
    default:
      return flag;
  }
}

export type BundleType = 'collection' | 'searchset';

export type BuildBundleInput = {
  id: string;
  type: BundleType;
  resources: FhirSupportedResource[];
  baseUrl?: string;
};

export function buildBundle(input: BuildBundleInput): FhirBundle {
  const base = input.baseUrl ?? `${MEDCRM_SYSTEM_BASE}/fhir`;
  const entry: FhirBundleEntry[] = input.resources.map((resource) => ({
    fullUrl: `${base}/${resource.resourceType}/${resource.id}`,
    resource,
    search: input.type === 'searchset' ? { mode: 'match' } : undefined
  }));

  return {
    resourceType: 'Bundle',
    id: input.id,
    meta: { lastUpdated: new Date().toISOString() },
    type: input.type,
    timestamp: new Date().toISOString(),
    total: entry.length,
    entry
  };
}
