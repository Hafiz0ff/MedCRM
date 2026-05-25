import { redirect } from 'next/navigation';
import { DoctorsPage } from '@/modules/smart-scheduling/components/doctors-page';
import { getBootstrap } from '@/shared/api/server-api';
import { can } from '@/shared/permissions/can';

export default async function Page() {
  const bootstrap = await getBootstrap();
  if (!bootstrap || !can(bootstrap, 'scheduling.calendar.read')) redirect('/dashboard');
  return <DoctorsPage bootstrap={bootstrap} />;
}
