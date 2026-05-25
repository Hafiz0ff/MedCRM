import { redirect } from 'next/navigation';
import { CalendarPage } from '@/modules/smart-scheduling/components/calendar-page';
import { getBootstrap } from '@/shared/api/server-api';
import { can } from '@/shared/permissions/can';

export default async function Page() {
  const bootstrap = await getBootstrap();
  if (!bootstrap || !can(bootstrap, 'scheduling.appointments.read')) redirect('/dashboard');
  return <CalendarPage bootstrap={bootstrap} />;
}
