import { PatientDetails } from '@/modules/patient-crm/components/patient-details';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PatientDetails id={id} />;
}
