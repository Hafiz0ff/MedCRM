export function toFhirPatient(patient: any): any {
  if (!patient) return null;

  const telecom = (patient.contacts || []).map((c: any) => ({
    system: c.type === 'EMAIL' ? 'email' : 'phone',
    value: c.value,
    use: c.isPrimary ? 'home' : 'work',
  }));

  const genderMap: Record<string, string> = {
    MALE: 'male',
    FEMALE: 'female',
    OTHER: 'other',
  };

  return {
    resourceType: 'Patient',
    id: patient.id,
    active: true,
    identifier: [
      {
        system: 'https://medcrm.app/identifiers/patient-code',
        value: patient.patientCode,
      },
    ],
    name: [
      {
        use: 'official',
        family: patient.lastName,
        given: [patient.firstName, patient.middleName].filter(Boolean),
        text: patient.fullName,
      },
    ],
    gender: genderMap[patient.gender?.toUpperCase()] || 'unknown',
    birthDate: patient.birthDate
      ? new Date(patient.birthDate).toISOString().split('T')[0]
      : undefined,
    telecom,
  };
}

export function fromFhirPatient(fhirPatient: any): any {
  if (!fhirPatient) return null;

  const officialName =
    (fhirPatient.name || []).find((n: any) => n.use === 'official') || fhirPatient.name?.[0] || {};
  const lastName = officialName.family || 'Unknown';
  const given = officialName.given || [];
  const firstName = given[0] || 'Unknown';
  const middleName = given[1] || null;
  const fullName = officialName.text || [lastName, firstName, middleName].filter(Boolean).join(' ');

  const genderMap: Record<string, string> = {
    male: 'MALE',
    female: 'FEMALE',
    other: 'OTHER',
  };

  const birthDate = fhirPatient.birthDate ? new Date(fhirPatient.birthDate) : null;
  const gender = genderMap[fhirPatient.gender?.toLowerCase()] || 'OTHER';

  const contacts = (fhirPatient.telecom || []).map((t: any) => ({
    type: t.system?.toUpperCase() === 'EMAIL' ? 'EMAIL' : 'PHONE',
    value: t.value,
    isPrimary: t.use === 'home',
  }));

  const identifier = (fhirPatient.identifier || []).find((i: any) =>
    i.system?.includes('patient-code'),
  )?.value;
  const patientCode = identifier || `P-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  return {
    firstName,
    lastName,
    middleName,
    fullName,
    gender,
    birthDate,
    patientCode,
    contacts,
  };
}
