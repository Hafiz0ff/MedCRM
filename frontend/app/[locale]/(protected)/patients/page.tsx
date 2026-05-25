import { redirect } from 'next/navigation';
import { PatientsPage } from '@/modules/patient-crm/components/patients-page';
import { getBootstrap } from '@/shared/api/server-api';
import { can } from '@/shared/permissions/can';

export default async function Page() {
  const bootstrap = await getBootstrap();
  if (!bootstrap || !can(bootstrap, 'patients.read')) redirect('/dashboard');
  return <PatientsPage bootstrap={bootstrap} />;
}
