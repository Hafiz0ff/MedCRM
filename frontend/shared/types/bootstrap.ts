export type BootstrapPayload = {
  tenant: {
    id: string;
    code: string;
    name: string;
    locale: string;
    subscriptionPlan: string;
  };
  enabledModules: string[];
  permissions: string[];
  branches: Array<{ id: string; code: string; name: string }>;
  featureFlags: Record<string, boolean | string | number>;
};

export type PatientContact = {
  id: string;
  type: string;
  value: string;
  isPrimary: boolean;
};

export type Patient = {
  id: string;
  patientCode: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  fullName: string;
  birthDate?: string | null;
  gender?: string | null;
  status: string;
  registrationBranchId?: string | null;
  contacts: PatientContact[];
};

export type Service = {
  id: string;
  code: string;
  name: string;
  durationMinutes: number;
  color?: string | null;
};

export type Doctor = {
  id: string;
  name: string;
  branchId: string;
  branchName: string;
  role: string;
};

export type Appointment = {
  id: string;
  branchId: string;
  patientId: string;
  employeeId: string;
  serviceId?: string | null;
  appointmentNumber: string;
  status: string;
  startAt: string;
  endAt: string;
  notes?: string | null;
  patient: Patient;
  service?: Service | null;
  employee?: {
    id: string;
    firstName: string;
    lastName: string;
    middleName?: string | null;
  } | null;
};
