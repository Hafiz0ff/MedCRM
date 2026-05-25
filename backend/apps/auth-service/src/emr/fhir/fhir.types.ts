/**
 * Minimal FHIR R4 resource type definitions used by the MedCRM export pipeline.
 *
 * These are *not* a complete FHIR schema — only the fields the mappers in
 * `fhir-mappers.ts` actually populate. Extra fields can be added per resource
 * as the export coverage grows.
 *
 * Spec: https://hl7.org/fhir/R4/
 */

export type FhirCoding = {
  system?: string;
  code?: string;
  display?: string;
};

export type FhirCodeableConcept = {
  coding?: FhirCoding[];
  text?: string;
};

export type FhirIdentifier = {
  use?: 'usual' | 'official' | 'temp' | 'secondary' | 'old';
  system?: string;
  value: string;
};

export type FhirHumanName = {
  use?: 'usual' | 'official' | 'temp' | 'nickname' | 'anonymous' | 'old' | 'maiden';
  family?: string;
  given?: string[];
  text?: string;
};

export type FhirContactPoint = {
  system?: 'phone' | 'fax' | 'email' | 'pager' | 'url' | 'sms' | 'other';
  value?: string;
  use?: 'home' | 'work' | 'temp' | 'old' | 'mobile';
};

export type FhirReference = {
  reference: string;
  display?: string;
};

export type FhirPeriod = {
  start?: string;
  end?: string;
};

export type FhirQuantity = {
  value?: number;
  unit?: string;
  system?: string;
  code?: string;
};

export type FhirExtension = {
  url: string;
  valueString?: string;
  valueCode?: string;
  valueBoolean?: boolean;
  valueInteger?: number;
};

export type FhirMeta = {
  versionId?: string;
  lastUpdated?: string;
  profile?: string[];
  source?: string;
};

export type FhirResourceBase = {
  resourceType: string;
  id: string;
  meta?: FhirMeta;
};

// Resource: Patient (R4)
export type FhirPatient = FhirResourceBase & {
  resourceType: 'Patient';
  identifier?: FhirIdentifier[];
  active?: boolean;
  name?: FhirHumanName[];
  telecom?: FhirContactPoint[];
  gender?: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: string;
  extension?: FhirExtension[];
};

// Resource: Encounter (R4)
export type FhirEncounter = FhirResourceBase & {
  resourceType: 'Encounter';
  status: 'planned' | 'arrived' | 'triaged' | 'in-progress' | 'onleave' | 'finished' | 'cancelled' | 'entered-in-error' | 'unknown';
  class: FhirCoding;
  type?: FhirCodeableConcept[];
  subject: FhirReference;
  participant?: Array<{
    type?: FhirCodeableConcept[];
    individual?: FhirReference;
  }>;
  period?: FhirPeriod;
  reasonCode?: FhirCodeableConcept[];
  diagnosis?: Array<{
    condition: FhirReference;
    use?: FhirCodeableConcept;
    rank?: number;
  }>;
  partOf?: FhirReference;
};

// Resource: Condition (R4)
export type FhirCondition = FhirResourceBase & {
  resourceType: 'Condition';
  clinicalStatus?: FhirCodeableConcept;
  verificationStatus?: FhirCodeableConcept;
  category?: FhirCodeableConcept[];
  code?: FhirCodeableConcept;
  subject: FhirReference;
  encounter?: FhirReference;
  recordedDate?: string;
  recorder?: FhirReference;
  note?: Array<{ text: string }>;
};

// Resource: MedicationRequest (R4)
export type FhirMedicationRequest = FhirResourceBase & {
  resourceType: 'MedicationRequest';
  status: 'active' | 'on-hold' | 'cancelled' | 'completed' | 'entered-in-error' | 'stopped' | 'draft' | 'unknown';
  intent: 'proposal' | 'plan' | 'order' | 'original-order' | 'reflex-order' | 'filler-order' | 'instance-order' | 'option';
  medicationCodeableConcept?: FhirCodeableConcept;
  subject: FhirReference;
  encounter?: FhirReference;
  authoredOn?: string;
  requester?: FhirReference;
  reasonReference?: FhirReference[];
  dosageInstruction?: Array<{
    text?: string;
    route?: FhirCodeableConcept;
    timing?: { code?: FhirCodeableConcept; repeat?: { duration?: number; durationUnit?: string } };
    doseAndRate?: Array<{ doseQuantity?: FhirQuantity }>;
  }>;
  dispenseRequest?: {
    quantity?: FhirQuantity;
  };
  note?: Array<{ text: string }>;
};

// Resource: Observation (R4)
export type FhirObservation = FhirResourceBase & {
  resourceType: 'Observation';
  status: 'registered' | 'preliminary' | 'final' | 'amended' | 'corrected' | 'cancelled' | 'entered-in-error' | 'unknown';
  category?: FhirCodeableConcept[];
  code: FhirCodeableConcept;
  subject: FhirReference;
  encounter?: FhirReference;
  effectiveDateTime?: string;
  valueString?: string;
  valueQuantity?: FhirQuantity;
  interpretation?: FhirCodeableConcept[];
  referenceRange?: Array<{ text?: string }>;
};

export type FhirSupportedResource =
  | FhirPatient
  | FhirEncounter
  | FhirCondition
  | FhirMedicationRequest
  | FhirObservation;

export type FhirBundleEntry<T extends FhirSupportedResource = FhirSupportedResource> = {
  fullUrl: string;
  resource: T;
  search?: { mode: 'match' | 'include' | 'outcome' };
};

export type FhirBundle = {
  resourceType: 'Bundle';
  id: string;
  meta?: FhirMeta;
  type: 'collection' | 'searchset';
  timestamp: string;
  total: number;
  entry: FhirBundleEntry[];
};

export const FHIR_RESOURCE_TYPES = [
  'Patient',
  'Encounter',
  'Condition',
  'MedicationRequest',
  'Observation'
] as const;

export type FhirResourceTypeName = (typeof FHIR_RESOURCE_TYPES)[number];
