export function toFhirPractitioner(employee: any): any {
  if (!employee) return null;
  return {
    resourceType: 'Practitioner',
    id: employee.id,
    active: employee.isActive ?? true,
    name: [
      {
        use: 'official',
        family: employee.lastName || '',
        given: [employee.firstName || '', employee.middleName].filter(Boolean),
        text: employee.fullName || `${employee.lastName} ${employee.firstName}`,
      },
    ],
    telecom: employee.phone
      ? [
          {
            system: 'phone',
            value: employee.phone,
            use: 'work',
          },
        ]
      : [],
  };
}

export function toFhirEncounter(encounter: any): any {
  if (!encounter) return null;

  const fhirStatusMap: Record<string, string> = {
    DRAFT: 'planned',
    IN_PROGRESS: 'in-progress',
    SIGNED: 'completed',
    AMENDED: 'amended',
  };

  return {
    resourceType: 'Encounter',
    id: encounter.id,
    status: fhirStatusMap[encounter.status] || 'unknown',
    class: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
            code: encounter.encounterType === 'HOME' ? 'HH' : 'AMB', // Ambulatory or Home Health
            display: encounter.encounterType === 'HOME' ? 'home health' : 'ambulatory',
          },
        ],
      },
    ],
    subject: {
      reference: `Patient/${encounter.patientId}`,
    },
    participant: [
      {
        actor: {
          reference: `Practitioner/${encounter.doctorEmployeeId}`,
        },
      },
    ],
    period: {
      start: encounter.startedAt?.toISOString(),
      end: encounter.completedAt?.toISOString() || undefined,
    },
  };
}

export function toFhirCondition(diag: any): any {
  if (!diag) return null;
  return {
    resourceType: 'Condition',
    id: diag.id,
    clinicalStatus: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
          code: 'active',
        },
      ],
    },
    verificationStatus: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
          code: 'confirmed',
        },
      ],
    },
    code: {
      coding: [
        {
          system: 'http://hl7.org/fhir/sid/icd-10',
          code: diag.icdCode || diag.code || 'UNKNOWN',
          display: diag.diagnosisText || diag.name || 'Diagnosed Condition',
        },
      ],
      text: diag.diagnosisText || diag.name || 'Diagnosed Condition',
    },
    subject: {
      reference: `Patient/${diag.patientId}`,
    },
    encounter: diag.encounterId
      ? {
          reference: `Encounter/${diag.encounterId}`,
        }
      : undefined,
  };
}

export function toFhirObservation(obs: any): any {
  if (!obs) return null;
  return {
    resourceType: 'Observation',
    id: obs.id,
    status: 'final',
    code: {
      coding: [
        {
          system: obs.loincCode ? 'http://loinc.org' : 'https://medcrm.app/codes/observations',
          code: obs.observationCode || obs.code || 'OBS',
          display: obs.observationName || obs.name || 'Clinical Observation',
        },
      ],
      text: obs.observationName || obs.name || 'Clinical Observation',
    },
    subject: {
      reference: `Patient/${obs.patientId}`,
    },
    encounter: obs.encounterId
      ? {
          reference: `Encounter/${obs.encounterId}`,
        }
      : undefined,
    effectiveDateTime: (
      obs.observedAt ||
      obs.measuredAt ||
      obs.createdAt ||
      new Date()
    ).toISOString(),
    valueQuantity:
      obs.value !== undefined
        ? {
            value: Number(obs.value) || 0,
            unit: obs.unit || undefined,
            system: obs.unit ? 'http://unitsofmeasure.org' : undefined,
          }
        : undefined,
    interpretation: obs.abnormalFlag
      ? [
          {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
                code: obs.abnormalFlag, // e.g. H, L
              },
            ],
          },
        ]
      : undefined,
    referenceRange: obs.referenceRange
      ? [
          {
            text: obs.referenceRange,
          },
        ]
      : undefined,
  };
}

export function toFhirMedicationRequest(item: any): any {
  if (!item) return null;
  return {
    resourceType: 'MedicationRequest',
    id: item.id,
    status: 'active',
    intent: 'order',
    medication: {
      concept: {
        coding: [
          {
            system: 'https://medcrm.app/codes/inn',
            code: item.innCode || 'UNKNOWN',
            display: item.innCode || 'Prescribed Drug',
          },
        ],
        text: item.innCode || 'Prescribed Drug',
      },
    },
    subject: {
      reference: `Patient/${item.prescription?.patientId || item.patientId}`,
    },
    encounter: item.prescription?.encounterId
      ? {
          reference: `Encounter/${item.prescription.encounterId}`,
        }
      : undefined,
    authoredOn: (item.createdAt || new Date()).toISOString(),
    dosageInstruction: [
      {
        text: item.dosage || 'Take as directed',
        timing: {
          repeat: {
            frequency: item.frequencyPerDay || 1,
            period: 1,
            periodUnit: 'd',
          },
        },
        doseAndRate: [
          {
            doseQuantity: {
              value: Number(item.dose) || 1,
              unit: item.doseUnit || 'tab',
            },
          },
        ],
      },
    ],
  };
}

export function toFhirAllergyIntolerance(allergy: any): any {
  if (!allergy) return null;
  return {
    resourceType: 'AllergyIntolerance',
    id: allergy.id,
    clinicalStatus: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical',
          code: 'active',
        },
      ],
    },
    verificationStatus: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification',
          code: 'confirmed',
        },
      ],
    },
    type: 'allergy',
    category: ['medication'],
    code: {
      coding: [
        {
          system: 'https://medcrm.app/codes/allergens',
          code: allergy.allergenId || 'ALLERGEN',
          display: allergy.allergenName || 'Drug Allergy',
        },
      ],
      text: allergy.allergenName || 'Drug Allergy',
    },
    patient: {
      reference: `Patient/${allergy.patientId}`,
    },
  };
}

export function toFhirServiceRequest(order: any): any {
  if (!order) return null;
  return {
    resourceType: 'ServiceRequest',
    id: order.id,
    status: order.orderStatus === 'COMPLETED' ? 'completed' : 'active',
    intent: 'order',
    code: {
      text: 'Laboratory panel order',
    },
    subject: {
      reference: `Patient/${order.patientId}`,
    },
    encounter: order.encounterId ? { reference: `Encounter/${order.encounterId}` } : undefined,
    occurrenceDateTime: (order.orderedAt || order.createdAt || new Date()).toISOString(),
    requester: {
      reference: `Practitioner/${order.orderedBy}`,
    },
  };
}

export function toFhirDiagnosticReport(result: any): any {
  if (!result) return null;
  return {
    resourceType: 'DiagnosticReport',
    id: result.id,
    status: result.resultStatus?.toLowerCase() === 'final' ? 'final' : 'partial',
    code: {
      coding: [
        {
          system: 'http://loinc.org',
          code: '11502-2',
          display: 'Laboratory report',
        },
      ],
    },
    subject: {
      reference: `Patient/${result.patientId}`,
    },
    effectiveDateTime: result.receivedAt?.toISOString() || new Date().toISOString(),
    issued: result.receivedAt?.toISOString() || new Date().toISOString(),
    result: (result.observations || []).map((o: any) => ({
      reference: `Observation/${o.id}`,
      display: o.observationName,
    })),
  };
}

export function toFhirAppointment(appt: any): any {
  if (!appt) return null;

  const fhirStatusMap: Record<string, string> = {
    CONFIRMED: 'booked',
    PENDING: 'pending',
    CANCELLED: 'cancelled',
    COMPLETED: 'fulfilled',
  };

  return {
    resourceType: 'Appointment',
    id: appt.id,
    status: fhirStatusMap[appt.status] || 'booked',
    start: appt.startTime?.toISOString(),
    end: appt.endTime?.toISOString(),
    participant: [
      {
        actor: {
          reference: `Patient/${appt.patientId}`,
        },
        status: 'accepted',
      },
      {
        actor: {
          reference: `Practitioner/${appt.doctorId || appt.doctorEmployeeId}`,
        },
        status: 'accepted',
      },
    ],
  };
}
